let apiKey = null;
let pages = [];
let currentPageIndex = 0;

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
        updateProgress(100, 'Binding the Book...', 'Ready!');
        setTimeout(function () {
          document.getElementById('bookTitleDisplay').textContent = title;
          currentPageIndex = 0;
          renderBook();
          switchView('viewer');
          document.getElementById('generateBtn').disabled = false;
          document.getElementById('generateBtn').classList.remove('opacity-50');
        }, 800);
        return Promise.resolve();
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
    '<img src="' + page.imageUrl + '" onerror="this.src=\'https://via.placeholder.com/1024?text=Image+Loading...\'" class="relative z-10 w-full max-h-[50vh] md:max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/10" alt="Illustration">' +
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
