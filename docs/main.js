/* ─────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

function showProcessing(show = true) {
  $('processing').style.display = show ? 'inline' : 'none';
}

function cleanText(text) {
  const zeroWidth = /[\u200B-\u200D\uFEFF]/g;
  const control = /[\x00-\x1F\x7F]/g;
  const nonBmp = /[\uD800-\uDFFF]/g;
  return text.replace(zeroWidth, '')
             .replace(control, '')
             .replace(nonBmp, '')
             .trim();
}

function estimateTokens(text) {
  if (!text) return 0;
  return text.split(/\s+/).length;
}

function downloadTxt(content, name = 'combined.txt') {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => alert('Copied to clipboard!'))
    .catch(err => console.error('Copy failed', err));
}

/* ─────────────────────────────────────────────────────
   1️⃣  URL → Article / PDF text
   ───────────────────────────────────────────────────── */
$('fetchUrlBtn').addEventListener('click', async () => {
  const url = $('urlInput').value.trim();
  if (!url) { alert('Please enter a URL'); return; }

  showProcessing(true);
  try {
    const isPdf = url.toLowerCase().endsWith('.pdf');
    const response = await fetch(url, { mode: 'cors' });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    if (isPdf) {
      // PDF fetched as ArrayBuffer
      const data = await response.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      let allText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const txt = await page.getTextContent();
        allText += txt.items.map(it => it.str).join(' ') + '\n\n';
      }
      const cleaned = cleanText(allText);
      $('summary').textContent = `Fetched PDF: ${url}`;
      $('tokenCount').textContent = `Estimated tokens: ${estimateTokens(cleaned)}`;
      $('combined').classList.remove('collapse');
      $('combined').classList.add('show');
      $('output').textContent = cleaned;
      $('toggleBtn').disabled = true;
      $('downloadBtn').disabled = false;
      $('copyBtn').disabled = false;
    } else {
      // Regular HTML page
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const article = new Readability(doc).parse();
      const raw = article ? article.textContent : 'No readable content found.';
      const cleaned = cleanText(raw);

      $('summary').textContent = `Fetched: ${url}`;
      $('tokenCount').textContent = `Estimated tokens: ${estimateTokens(cleaned)}`;
      $('combined').classList.remove('collapse');
      $('combined').classList.add('show');
      $('output').textContent = cleaned;
      $('toggleBtn').disabled = true;
      $('downloadBtn').disabled = false;
      $('copyBtn').disabled = false;
    }
    showProcessing(false);
  } catch (e) {
    console.error(e);
    showProcessing(false);
    alert('Could not fetch the page. Check CORS or the console for details.');
  }
});

/* ─────────────────────────────────────────────────────
   2️⃣  File → Text (PDF, TXT, MD)
   ───────────────────────────────────────────────────── */
$('processFileBtn').addEventListener('click', async () => {
  const files = $('fileInput').files;
  if (!files.length) { alert('Please select at least one file'); return; }

  showProcessing(true);
  const results = [];
  const summaries = [];

  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase();
    try {
      if (ext === 'pdf') {
        // PDF → Text
        const data = await new Promise(res => {
          const r = new FileReader();
          r.onload = e => res(e.target.result);
          r.readAsArrayBuffer(file);
        });
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        let allText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const txt = await page.getTextContent();
          allText += txt.items.map(it => it.str).join(' ') + '\n\n';
        }
        results.push(cleanText(allText));
        summaries.push(`${file.name} (PDF, ${pdf.numPages} pages)`);
      } else if (['txt', 'md', 'markdown'].includes(ext)) {
        // Plain text or markdown
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

  // Combine
  const combinedText = results.join('\n\n---\n\n');

  // UI
  $('summary').textContent = 'Files processed:\n' + summaries.join('\n');
  $('tokenCount').textContent = `Estimated tokens: ${estimateTokens(combinedText)}`;
  $('combined').classList.remove('collapse');
  $('combined').classList.add('show');
  $('output').textContent = combinedText;
  $('toggleBtn').disabled = false;
  $('downloadBtn').disabled = false;
  $('copyBtn').disabled = false;
  showProcessing(false);
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
  const txt = $('output').textContent;
  downloadTxt(txt, 'combined.txt');
});

$('copyBtn').addEventListener('click', () => {
  const txt = $('output').textContent;
  copyToClipboard(txt);
});

/* ─────────────────────────────────────────────────────
   Enable tooltips (Bootstrap)
   ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    new bootstrap.Tooltip(tooltipTriggerEl);
  });
});