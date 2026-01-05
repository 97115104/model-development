/* ─────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

/* Show / hide the loading modal */
function setLoading(show, msg = 'Processing…', percent = 0, detail = '') {
  const modal = new bootstrap.Modal(document.getElementById('loadingModal'));
  if (show) {
    $('loadingMessage').textContent = msg;
    $('loadingBar').style.width = percent + '%';
    $('loadingBar').setAttribute('aria-valuenow', percent);
    $('loadingDetail').textContent = detail;
    modal.show();
  } else {
    modal.hide();
  }
}

/* Clean text: remove zero‑width, control, non‑BMP */
function cleanText(text) {
  const zeroWidth = /[\u200B-\u200D\uFEFF]/g;
  const control   = /[\x00-\x1F\x7F]/g;
  const nonBmp    = /[\uD800-\uDFFF]/g;
  return text.replace(zeroWidth, '')
             .replace(control, '')
             .replace(nonBmp, '')
             .trim();
}

/* Estimate tokens (simple word count) */
function estimateTokens(text) {
  return text ? text.split(/\s+/).length : 0;
}

/* Download as .txt */
function downloadTxt(content, name = 'combined.txt') {
  const blob = new Blob([content], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href      = url;
  a.download  = name;
  a.click();
  URL.revokeObjectURL(url);
}

/* Copy to clipboard */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => alert('Copied to clipboard!'))
    .catch(err => console.error('Copy failed', err));
}

/* ─────────────────────────────────────────────────────
   OCR fallback for image‑based PDFs
   ───────────────────────────────────────────────────── */
async function ocrPage(page, pageIndex, totalPages) {
  const canvas = document.createElement('canvas');
  const viewport = page.getViewport({ scale: 1.5 });
  canvas.width  = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;

  // OCR
  const { data } = await Tesseract.recognize(canvas, 'eng', {
    logger: m => setLoading(true, `OCR page ${pageIndex+1}/${totalPages}`, Math.round((pageIndex+1)/totalPages*100))
  });
  return data.text;
}

/* Extract text from a single PDF page, with OCR fallback */
async function extractTextFromPage(page, pageIndex, totalPages) {
  const txt = await page.getTextContent();
  const raw = txt.items.map(it => it.str).join(' ');
  if (cleanText(raw).length > 20) {
    return cleanText(raw);
  }
  // If text is too short, try OCR
  return await ocrPage(page, pageIndex, totalPages);
}

/* ─────────────────────────────────────────────────────
   1️⃣  URL → Article / PDF text
   ───────────────────────────────────────────────────── */
$('fetchUrlBtn').addEventListener('click', async () => {
  const url = $('urlInput').value.trim();
  if (!url) { alert('Please enter a URL'); return; }

  setLoading(true, 'Fetching URL…');
  try {
    const isPdf = url.toLowerCase().endsWith('.pdf');
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    if (isPdf) {
      setLoading(true, 'Downloading PDF…');
      const data = await response.arrayBuffer();
      setLoading(true, 'Parsing PDF…', 0);
      const pdf  = await pdfjsLib.getDocument({ data }).promise;
      let allText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        allText += await extractTextFromPage(page, i-1, pdf.numPages) + '\n\n';
        setLoading(true, `Processing PDF…`, Math.round(i / pdf.numPages * 100));
      }
      $('summary').textContent = `Fetched PDF: ${url}`;
      $('tokenCount').textContent = `Estimated tokens: ${estimateTokens(allText)}`;
      $('output').textContent = allText.trim();
      $('toggleBtn').disabled = true;
      $('downloadBtn').disabled = false;
      $('copyBtn').disabled = false;
    } else {
      setLoading(true, 'Fetching page…');
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const article = new Readability(doc).parse();
      const raw = article ? article.textContent : 'No readable content found.';
      const cleaned = cleanText(raw);
      $('summary').textContent = `Fetched: ${url}`;
      $('tokenCount').textContent = `Estimated tokens: ${estimateTokens(cleaned)}`;
      $('output').textContent = cleaned;
      $('toggleBtn').disabled = true;
      $('downloadBtn').disabled = false;
      $('copyBtn').disabled = false;
    }
    $('combined').classList.remove('collapse');
    $('combined').classList.add('show');
    setLoading(false);
  } catch (e) {
    console.error(e);
    setLoading(false);
    alert('Could not fetch the page. Check CORS or the console for details.');
  }
});

/* ─────────────────────────────────────────────────────
   2️⃣  File → Text (PDF, TXT, MD)
   ───────────────────────────────────────────────────── */
$('processFileBtn').addEventListener('click', async () => {
  const files = $('fileInput').files;
  if (!files.length) { alert('Please select at least one file'); return; }

  setLoading(true, 'Reading files…');
  const results = [];
  const summaries = [];

  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase();
    try {
      if (ext === 'pdf') {
        setLoading(true, `Processing ${file.name}…`);
        const data = await new Promise(res => {
          const r = new FileReader();
          r.onload = e => res(e.target.result);
          r.readAsArrayBuffer(file);
        });
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        let allText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          allText += await extractTextFromPage(page, i-1, pdf.numPages) + '\n\n';
          setLoading(true, `Processing ${file.name}…`, Math.round(i / pdf.numPages * 100));
        }
        results.push(allText.trim());
        summaries.push(`${file.name} (PDF, ${pdf.numPages} pages)`);
      } else if (['txt', 'md', 'markdown'].includes(ext)) {
        const raw = await new Promise(res => {
          const r = new FileReader();
          r.onload = e => res(e.target.result);
          r.readAsText(file);
        });
        results.push(cleanText(raw));
        summaries.push(`${file.name} (${ext.toUpperCase()})`);
      } else {
        throw new Error(`Unsupported file type: ${file.name}`);
      }
    } catch (e) {
      console.error(e);
      alert(`Failed to process ${file.name}: ${e.message}`);
    }
  }

  const combinedText = results.join('\n\n---\n\n');
  $('summary').textContent = 'Files processed:\n' + summaries.join('\n');
  $('tokenCount').textContent = `Estimated tokens: ${estimateTokens(combinedText)}`;
  $('output').textContent = combinedText.trim();
  $('combined').classList.remove('collapse');
  $('combined').classList.add('show');
  $('toggleBtn').disabled = false;
  $('downloadBtn').disabled = false;
  $('copyBtn').disabled = false;
  setLoading(false);
});

/* ─────────────────────────────────────────────────────
   3️⃣  Collapse / Expand
   ───────────────────────────────────────────────────── */
$('toggleBtn').addEventListener('click', () => {
  const target = $('combined');
  target.classList.toggle('collapse');
  target.classList.toggle('show');
  $('toggleBtn').textContent = target.classList.contains('collapse')
    ? 'Show Combined Text'
    : 'Hide Combined Text';
});

/* ─────────────────────────────────────────────────────
   4️⃣  Download / Copy
   ───────────────────────────────────────────────────── */
$('downloadBtn').addEventListener('click', () => {
  downloadTxt($('output').textContent, 'combined.txt');
});

$('copyBtn').addEventListener('click', () => {
  copyToClipboard($('output').textContent);
});