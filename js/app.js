let apiKey = null;
let pages = [];
let currentPageIndex = 0;
let bookTitle = "";

// LocalStorage with error boundary
const Storage = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
};

// UI Updates
function setConnectionStatus(connected) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const btnText = document.getElementById('connectText');

  if (connected) {
    dot.className = 'w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)] animate-pulse';
    text.className = 'text-xs font-medium text-yellow-400';
    text.textContent = 'System Online';
    btnText.textContent = 'Connected';
  } else {
    dot.className = 'w-2 h-2 rounded-full bg-red-500';
    text.className = 'text-xs font-medium text-red-400';
    text.textContent = 'API Key Required';
    btnText.textContent = 'Connect API Key';
  }
}

function connectPollen() {
  const redirect = encodeURIComponent(window.location.protocol + '//' + window.location.host + window.location.pathname);
  window.location.href = 'https://enter.pollinations.ai/authorize?redirect_url=' + redirect + '&models=zimage,openai-fast&budget=100&expiry=30';
}

function toggleAdvancedSettings() {
  const panel = document.getElementById('advancedSettings');
  const icon = document.getElementById('advancedIcon');
  panel.classList.toggle('hidden');
  icon.classList.toggle('rotate-180');
}

// Init
window.onload = function () {
  var hashParams = new URLSearchParams(window.location.hash.slice(1));
  var urlKey = hashParams.get('api_key');

  if (urlKey) {
    apiKey = urlKey;
    Storage.set('pollen_key', apiKey);
    history.replaceState(null, null, ' ');
  } else {
    apiKey = Storage.get('pollen_key');
  }

  setConnectionStatus(!!apiKey);

  var pagesInput = document.getElementById('pages');
  var countDisplay = document.getElementById('pageCount');
  if (pagesInput) {
    pagesInput.addEventListener('input', function (e) {
      countDisplay.textContent = e.target.value + ' Pages';
    });
  }
};

// Robust JSON Parser
function parseLLMJson(text) {
  var cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '');
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '');
  if (cleaned.endsWith('```')) cleaned = cleaned.replace(/```$/, '');
  return JSON.parse(cleaned.trim());
}

// Text API call to Pollinations
function fetchStoryContent(prompt, system, textModel) {
  var payload = {
    model: textModel,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    jsonMode: true
  };

  if (textModel === 'openai' || textModel === 'openai-fast') {
    payload.response_format = { type: "json_object" };
  }

  return fetch('https://gen.pollinations.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }).then(function (res) {
    if (!res.ok) throw new Error('API Error: ' + res.status);
    return res.json();
  }).then(function (data) {
    return parseLLMJson(data.choices[0].message.content);
  });
}

// Generate Image URL
function getImageUrl(prompt, imageModel, dimensions, style) {
  var parts = dimensions.split('x');
  var width = parts[0];
  var height = parts[1];

  var finalPrompt = prompt;
  if (style) {
    var styleMap = {
      'anime': ', anime style, studio ghibli, makoto shinkai',
      'comic-book': ', comic book style, marvel, dc, graphic novel, highly detailed',
      'photorealistic': ', photorealistic, 8k, highly detailed, raw photo, realistic textures',
      'watercolor': ', beautiful watercolor painting, artistic, expressive strokes',
      '3d-model': ', 3d render, octane render, unreal engine 5, ray tracing',
      'cyberpunk': ', cyberpunk, neon lights, futuristic, highly detailed, sci-fi',
      'pixel-art': ', 16-bit pixel art, retro gaming style, crisp pixels'
    };
    finalPrompt += (styleMap[style] || '');
  } else {
    finalPrompt += ' masterpiece, high quality, trending on artstation';
  }

  var encoded = encodeURIComponent(finalPrompt);
  var seed = Math.floor(Math.random() * 1000000);
  return 'https://gen.pollinations.ai/image/' + encoded + '?model=' + imageModel + '&width=' + width + '&height=' + height + '&nologo=true&enhance=true&key=' + apiKey + '&seed=' + seed;
}

function switchView(view) {
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('viewer').classList.add('hidden');
  document.getElementById(view).classList.remove('hidden');
}

function updateProgress(percent, header, subtext) {
  document.getElementById('progressBar').style.width = percent + '%';
  if (header) document.getElementById('loadingText').textContent = header;
  if (subtext) document.getElementById('loadingSubtext').textContent = subtext;
}

// Preload a single image
function preloadImage(url) {
  return new Promise(function (resolve) {
    var img = new Image();
    img.onload = resolve;
    img.onerror = resolve;
    img.src = url;
  });
}

// Title regeneration via openai-fast
function regenerateTitle(originalTitle, genre, idea) {
  return fetch('https://gen.pollinations.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai-fast',
      messages: [
        { role: 'system', content: 'You are a creative book naming expert. Given a story title and its genre, generate a single improved, catchier, more evocative book title. Respond with ONLY the title text, no quotes, no explanation, no extra text.' },
        { role: 'user', content: 'Original title: "' + originalTitle + '". Genre: ' + genre + '. Story idea: ' + idea + '. Suggest a better title.' }
      ],
      temperature: 0.9
    })
  }).then(function (res) {
    if (!res.ok) return originalTitle;
    return res.json().then(function (data) {
      var t = data.choices[0].message.content.trim().replace(/^"|"$/g, '');
      return (t && t.length > 0 && t.length < 100) ? t : originalTitle;
    });
  }).catch(function () {
    return originalTitle;
  });
}

// Main generation
function generateBook() {
  if (!apiKey) {
    alert("Please connect your Pollinations API Key first to generate stories.");
    return;
  }

  var title = document.getElementById('title').value || "The Unknown Journey";
  var genre = document.getElementById('genre').value;
  var numPages = parseInt(document.getElementById('pages').value);
  var idea = document.getElementById('idea').value || "An epic spontaneous adventure.";
  var textModel = document.getElementById('textModel').value;
  var imageModel = document.getElementById('imageModel').value;
  var dimensions = document.getElementById('dimensions').value;
  var styleEl = document.getElementById('imageStyle');
  var imageStyle = styleEl ? styleEl.value : "";

  switchView('loadingState');
  updateProgress(10, 'Brainstorming... (' + textModel + ')', 'Consulting the LLM for the plot');
  document.getElementById('generateBtn').disabled = true;
  document.getElementById('generateBtn').classList.add('opacity-50');

  var systemPrompt = 'You are a master storyteller writing a ' + genre + ' storybook for a premium app. Respond ONLY with a JSON object containing a "pages" array. Each page object must have: "pageNumber" (1 to ' + numPages + '), "text" (2-3 engaging paragraphs), and "illustrationPrompt" (detailed comma-separated visual description of the scene for an AI image generator, focus on subject, environment, lighting, and style).';
  var userPrompt = 'Title: "' + title + '". Core Idea: ' + idea + '. Total exact pages: ' + numPages + '. Write the complete storybook.';

  fetchStoryContent(userPrompt, systemPrompt, textModel).then(function (storyData) {
    if (!storyData.pages || storyData.pages.length === 0) throw new Error("Invalid story structure");
    pages = storyData.pages;

    // Generate image URLs
    for (var i = 0; i < pages.length; i++) {
      pages[i].imageUrl = getImageUrl(pages[i].illustrationPrompt, imageModel, dimensions, imageStyle);
    }

    // Preload images one by one
    var loadNext = function (idx) {
      if (idx >= pages.length) {
        // All images done, now regenerate title
        updateProgress(95, 'Polishing the Title...', 'AI is crafting a better title');
        return regenerateTitle(title, genre, idea).then(function (newTitle) {
          bookTitle = newTitle;
          updateProgress(100, 'Binding the Book...', 'Ready!');
          setTimeout(function () {
            document.getElementById('bookTitleDisplay').textContent = bookTitle;
            currentPageIndex = 0;
            renderBook();
            switchView('viewer');
            document.getElementById('generateBtn').disabled = false;
            document.getElementById('generateBtn').classList.remove('opacity-50');
          }, 800);
        });
      }
      var pct = Math.round(((idx / pages.length) * 80) + 15);
      var snippet = pages[idx].illustrationPrompt.substring(0, 40);
      updateProgress(pct, 'Painting... (' + imageModel + ')', 'Rendering page ' + (idx + 1) + ' of ' + pages.length + '\n' + snippet + '...');
      return preloadImage(pages[idx].imageUrl).then(function () {
        return loadNext(idx + 1);
      });
    };

    return loadNext(0);
  }).catch(function (err) {
    console.error(err);
    alert("Generation failed. Please try a simpler prompt or switch Text Models.");
    switchView('emptyState');
    document.getElementById('generateBtn').disabled = false;
    document.getElementById('generateBtn').classList.remove('opacity-50');
  });
}

// Render current page
function renderBook() {
  var page = pages[currentPageIndex];
  var container = document.getElementById('pageContent');

  container.classList.remove('page-turn-enter');
  void container.offsetWidth;
  container.classList.add('page-turn-enter');

  var dotsArr = [];
  for (var i = 0; i < pages.length; i++) {
    var cls = (i === currentPageIndex) ? 'bg-yellow-400 w-6' : 'bg-zinc-600 hover:bg-zinc-400';
    dotsArr.push('<button onclick="jumpToPage(' + i + ')" class="w-2.5 h-2.5 rounded-full transition-all ' + cls + '"></button>');
  }
  document.getElementById('pageDots').innerHTML = dotsArr.join('');

  var idx = currentPageIndex;
  var safeText = page.text.replace(/\n\n/g, '<br><br>');

  container.innerHTML =
    '<div class="flex-1 border-b md:border-b-0 md:border-r border-zinc-800 relative bg-black flex items-center justify-center p-4">' +
    '<div class="absolute inset-0 bg-cover bg-center opacity-30 blur-xl" style="background-image: url(\'' + page.imageUrl + '\')"></div>' +
    '<div class="relative z-10 w-full flex items-center justify-center">' +
    '<img src="' + page.imageUrl + '" onerror="this.src=\'https://via.placeholder.com/1024?text=Image+Loading...\'" class="w-full max-h-[50vh] md:max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/10 cursor-pointer" alt="Illustration" onclick="openFullscreen(' + idx + ')">' +
    '<button onclick="openFullscreen(' + idx + ')" class="absolute bottom-6 right-6 w-10 h-10 rounded-full bg-black/60 hover:bg-yellow-400 hover:text-zinc-900 backdrop-blur border border-white/20 flex items-center justify-center transition-all text-white text-sm shadow-lg" title="View Fullscreen">' +
    '<i class="fa-solid fa-expand"></i>' +
    '</button>' +
    '</div>' +
    '</div>' +
    '<div class="flex-1 p-8 md:p-14 overflow-y-auto bg-[#18181b] relative">' +
    '<div class="absolute top-4 right-8 text-[8rem] font-bold text-zinc-800/20 pointer-events-none book-font">' + (idx + 1) + '</div>' +
    '<div class="relative z-10">' +
    '<h3 class="text-yellow-500 font-bold mb-6 tracking-widest text-sm uppercase">Chapter ' + (idx + 1) + '</h3>' +
    '<div class="text-zinc-300 text-lg md:text-xl leading-relaxed book-font font-light">' + safeText + '</div>' +
    '<div class="mt-12 pt-6 border-t border-zinc-800 text-xs text-zinc-600 font-mono">' +
    '<span class="text-yellow-600/50">PROMPT:</span> ' + page.illustrationPrompt +
    '</div>' +
    '</div>' +
    '</div>';
}

function nextPage() {
  if (currentPageIndex < pages.length - 1) { currentPageIndex++; renderBook(); }
}

function prevPage() {
  if (currentPageIndex > 0) { currentPageIndex--; renderBook(); }
}

function jumpToPage(i) {
  if (i >= 0 && i < pages.length) { currentPageIndex = i; renderBook(); }
}

// ========== FULLSCREEN IMAGE VIEWER ==========
function openFullscreen(pageIndex) {
  var overlay = document.getElementById('fullscreenOverlay');
  var img = document.getElementById('fullscreenImage');
  if (pages[pageIndex]) {
    img.src = pages[pageIndex].imageUrl;
  }
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeFullscreen(e) {
  var overlay = document.getElementById('fullscreenOverlay');
  // Close if clicking overlay bg, close button, or its icon
  if (!e || e.target === overlay || e.target.closest('.fullscreen-close')) {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }
}

// Escape key closes fullscreen
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    var overlay = document.getElementById('fullscreenOverlay');
    if (overlay && overlay.style.display === 'flex') {
      overlay.style.display = 'none';
      document.body.style.overflow = '';
    }
  }
});

// ========== ZIP DOWNLOAD ==========
function downloadZip() {
  if (!pages || pages.length === 0) {
    alert('No book to save yet! Generate a story first.');
    return;
  }

  var saveBtn = document.getElementById('saveBtn');
  if (!saveBtn) return;

  // Check if JSZip is available
  if (typeof JSZip === 'undefined') {
    alert('ZIP library is still loading. Please wait a moment and try again.');
    return;
  }

  var originalHTML = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Packing...';

  var zip = new JSZip();
  var folderName = (bookTitle || 'PollenPages-Story').replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_') || 'Story';
  var folder = zip.folder(folderName);

  // Add all text files first
  for (var i = 0; i < pages.length; i++) {
    var pg = pages[i];
    var num = i + 1;
    var txt = 'Page ' + num + '\n========================================\n\n' + pg.text + '\n\n---\nIllustration Prompt: ' + pg.illustrationPrompt;
    folder.file('page' + num + '.txt', txt);
  }

  // Add readme
  folder.file('README.txt', bookTitle + '\nGenerated by PollenPages (pollinations.ai)\nTotal pages: ' + pages.length + '\n');

  // Try to fetch images and add them
  var imagePromises = [];
  for (var j = 0; j < pages.length; j++) {
    (function (index) {
      var pageNum = index + 1;
      var p = fetch(pages[index].imageUrl, { mode: 'cors' })
        .then(function (res) {
          if (res.ok) return res.blob();
          return null;
        })
        .then(function (blob) {
          if (blob) {
            folder.file('page' + pageNum + '.png', blob);
          }
        })
        .catch(function (err) {
          console.warn('Image fetch failed for page ' + pageNum, err);
        });
      imagePromises.push(p);
    })(j);
  }

  Promise.all(imagePromises).then(function () {
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Zipping...';
    return zip.generateAsync({ type: 'blob' });
  }).then(function (content) {
    // Use FileSaver if available, otherwise manual download
    if (typeof saveAs !== 'undefined') {
      saveAs(content, folderName + '.zip');
    } else {
      var url = URL.createObjectURL(content);
      var a = document.createElement('a');
      a.href = url;
      a.download = folderName + '.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }).catch(function (err) {
    console.error('ZIP failed:', err);
    alert('Failed to create ZIP. Please try again.');
  }).finally(function () {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalHTML;
  });
}
