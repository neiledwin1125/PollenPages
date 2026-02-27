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

async function connectPollen() {
  const redirect = encodeURIComponent(window.location.protocol + '//' + window.location.host + window.location.pathname);
  window.location.href = `https://enter.pollinations.ai/authorize?redirect_url=${redirect}&models=zimage,openai-fast&budget=100&expiry=30`;
}

function toggleAdvancedSettings() {
  const panel = document.getElementById('advancedSettings');
  const icon = document.getElementById('advancedIcon');
  panel.classList.toggle('hidden');
  icon.classList.toggle('rotate-180');
}

// Init
window.onload = () => {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const urlKey = hashParams.get('api_key');

  if (urlKey) {
    apiKey = urlKey;
    Storage.set('pollen_key', apiKey);
    history.replaceState(null, null, ' ');
  } else {
    apiKey = Storage.get('pollen_key');
  }

  setConnectionStatus(!!apiKey);

  const pagesInput = document.getElementById('pages');
  const countDisplay = document.getElementById('pageCount');
  if (pagesInput) {
    pagesInput.addEventListener('input', (e) => {
      countDisplay.textContent = `${e.target.value} Pages`;
    });
  }
};

// Robust JSON Parser
function parseLLMJson(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '');
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '');
  if (cleaned.endsWith('```')) cleaned = cleaned.replace(/```$/, '');
  return JSON.parse(cleaned.trim());
}

// Advanced Text API call to Pollinations
async function fetchStoryContent(prompt, system, textModel) {
  const payload = {
    model: textModel,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    jsonMode: true // Fallback request for json mode on other models
  };

  // Only OpenAI strictly requires the object formatting for json response format
  if (textModel === 'openai' || textModel === 'openai-fast') {
    payload.response_format = { type: "json_object" };
  }

  const res = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  const data = await res.json();
  return parseLLMJson(data.choices[0].message.content);
}

// Generate Image with advanced parameters
function getImageUrl(prompt, imageModel, dimensions, style) {
  const [width, height] = dimensions.split('x');

  let finalPrompt = prompt;
  if (style) {
    if (style === 'anime') finalPrompt += ", anime style, studio ghibli, makoto shinkai";
    else if (style === 'comic-book') finalPrompt += ", comic book style, marvel, dc, graphic novel, highly detailed";
    else if (style === 'photorealistic') finalPrompt += ", photorealistic, 8k, highly detailed, raw photo, realistic textures";
    else if (style === 'watercolor') finalPrompt += ", beautiful watercolor painting, artistic, expressive strokes";
    else if (style === '3d-model') finalPrompt += ", 3d render, octane render, unreal engine 5, ray tracing";
    else if (style === 'cyberpunk') finalPrompt += ", cyberpunk, neon lights, futuristic, highly detailed, sci-fi";
    else if (style === 'pixel-art') finalPrompt += ", 16-bit pixel art, retro gaming style, crisp pixels";
  } else {
    finalPrompt += " masterpiece, high quality, trending on artstation";
  }

  const enhancedPrompt = encodeURIComponent(finalPrompt);
  return `https://gen.pollinations.ai/image/${enhancedPrompt}?model=${imageModel}&width=${width}&height=${height}&nologo=true&enhance=true&key=${apiKey}&seed=${Math.floor(Math.random() * 1000000)}`;
}

function switchView(view) {
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('viewer').classList.add('hidden');
  document.getElementById(view).classList.remove('hidden');
}

function updateProgress(percent, header, subtext) {
  document.getElementById('progressBar').style.width = `${percent}%`;
  if (header) document.getElementById('loadingText').textContent = header;
  if (subtext) document.getElementById('loadingSubtext').textContent = subtext;
}

async function generateBook() {
  if (!apiKey) {
    alert("Please connect your Pollinations API Key first to generate stories.");
    return;
  }

  // Core Settings
  const title = document.getElementById('title').value || "The Unknown Journey";
  const genre = document.getElementById('genre').value;
  const numPages = parseInt(document.getElementById('pages').value);
  const idea = document.getElementById('idea').value || "An epic spontaneous adventure.";

  // Advanced Settings
  const textModel = document.getElementById('textModel').value;
  const imageModel = document.getElementById('imageModel').value;
  const dimensions = document.getElementById('dimensions').value;
  const imageStyle = document.getElementById('imageStyle') ? document.getElementById('imageStyle').value : "";

  switchView('loadingState');
  updateProgress(10, `Brainstorming... (${textModel})`, "Consulting the LLM for the plot");
  document.getElementById('generateBtn').disabled = true;
  document.getElementById('generateBtn').classList.add('opacity-50');

  try {
    const systemPrompt = `You are a master storyteller writing a ${genre} storybook for a premium app.
    Respond ONLY with a JSON object containing a "pages" array.
    Each page object must have: "pageNumber" (1 to ${numPages}), "text" (2-3 engaging paragraphs), and "illustrationPrompt" (detailed comma-separated visual description of the scene for an AI image generator, focus on subject, environment, lighting, and style).`;

    const userPrompt = `Title: "${title}". Core Idea: ${idea}. Total exact pages: ${numPages}. Write the complete storybook.`;

    const storyData = await fetchStoryContent(userPrompt, systemPrompt, textModel);

    if (!storyData.pages || storyData.pages.length === 0) throw new Error("Invalid story structure generated");
    pages = storyData.pages;

    // Start generating images
    for (let i = 0; i < pages.length; i++) {
      const p = parseFloat(((i / pages.length) * 80) + 15).toFixed(0);
      updateProgress(p, `Painting... (${imageModel})`, `Rendering page ${i + 1} of ${pages.length}\n${pages[i].illustrationPrompt.substring(0, 40)}...`);

      pages[i].imageUrl = getImageUrl(pages[i].illustrationPrompt, imageModel, dimensions, imageStyle);

      await new Promise((resolve) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve;
        img.src = pages[i].imageUrl;
      });
    }

    updateProgress(100, "Binding the Book...", "Ready!");

    setTimeout(() => {
      document.getElementById('bookTitleDisplay').textContent = title;
      currentPageIndex = 0;
      renderBook();
      switchView('viewer');
      document.getElementById('generateBtn').disabled = false;
      document.getElementById('generateBtn').classList.remove('opacity-50');
    }, 800);

  } catch (err) {
    console.error(err);
    alert("Generation failed. Please try a simpler prompt or switch Text Models.");
    switchView('emptyState');
    document.getElementById('generateBtn').disabled = false;
    document.getElementById('generateBtn').classList.remove('opacity-50');
  }
}

function renderBook() {
  const page = pages[currentPageIndex];
  const container = document.getElementById('pageContent');

  container.classList.remove('page-turn-enter');
  void container.offsetWidth;
  container.classList.add('page-turn-enter');

  const dotsHTML = pages.map((_, i) =>
    `<button onclick="jumpToPage(${i})" class="w-2.5 h-2.5 rounded-full transition-all ${i === currentPageIndex ? 'bg-yellow-400 w-6' : 'bg-zinc-600 hover:bg-zinc-400'}"></button>`
  ).join('');
  document.getElementById('pageDots').innerHTML = dotsHTML;

  const html = `
    <div class="flex-1 border-b md:border-b-0 md:border-r border-zinc-800 relative bg-black flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-cover bg-center opacity-30 blur-xl" style="background-image: url('${page.imageUrl}')"></div>
      <img src="${page.imageUrl}" onerror="this.src='https://via.placeholder.com/1024?text=Image+Generating...'" class="relative z-10 w-full max-h-[50vh] md:max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/10" alt="Illustration">
    </div>
    <div class="flex-1 p-8 md:p-14 overflow-y-auto bg-[#18181b] relative">
      <div class="absolute top-4 right-8 text-[8rem] font-bold text-zinc-800/20 pointer-events-none book-font">${currentPageIndex + 1}</div>
      <div class="relative z-10">
        <h3 class="text-yellow-500 font-bold mb-6 tracking-widest text-sm uppercase">Chapter ${currentPageIndex + 1}</h3>
        <div class="text-zinc-300 text-lg md:text-xl leading-relaxed book-font font-light">
          ${page.text.replace(/\n\n/g, '<br><br>')}
        </div>
        <div class="mt-12 pt-6 border-t border-zinc-800 text-xs text-zinc-600 font-mono">
          <span class="text-yellow-600/50">PROMPT:</span> ${page.illustrationPrompt}
        </div>
      </div>
    </div>
  `;
  container.innerHTML = html;
}

function nextPage() {
  if (currentPageIndex < pages.length - 1) {
    currentPageIndex++;
    renderBook();
  }
}

function prevPage() {
  if (currentPageIndex > 0) {
    currentPageIndex--;
    renderBook();
  }
}

function jumpToPage(i) {
  if (i >= 0 && i < pages.length) {
    currentPageIndex = i;
    renderBook();
  }
}

function downloadPDF() {
  alert("Save feature is simulated. Wait for an app update or print this page!");
}
