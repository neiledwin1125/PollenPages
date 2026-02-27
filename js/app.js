let apiKey = null;
let pages = [];
let currentPageIndex = 0;
let currentBookTitle = "";

const Storage = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
};

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

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFullscreen();
  });
};

function parseLLMJson(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '');
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '');
  if (cleaned.endsWith('```')) cleaned = cleaned.replace(/```$/, '');
  return JSON.parse(cleaned.trim());
}

async function fetchStoryContent(prompt, system, textModel) {
  const payload = {
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

async function fetchSimpleText(prompt, system) {
  const payload = {
    model: 'openai-fast',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt }
    ],
    temperature: 0.8
  };

  const res = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(`Title API Error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
}

async function regenerateTitle(originalTitle, genre, idea) {
  const system = `You are a creative book title expert. You take a rough working title and transform it into a captivating, memorable book title. Return ONLY the new title text, nothing else. No quotes, no explanation.`;
  const prompt = `Improve this book title to be more captivating and memorable.\nOriginal title: "${originalTitle}"\nGenre: ${genre}\nStory idea: ${idea}\nGive me one single improved title.`;

  try {
    const betterTitle = await fetchSimpleText(prompt, system);
    return betterTitle;
  } catch (err) {
    console.warn("Title regeneration failed, using original:", err);
    return originalTitle;
  }
}

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

function loadSampleBook() {
  currentBookTitle = "Gelo and the Spell That Kept Him from School";
  pages = [
    {
      pageNumber: 1,
      text: "In a village stitched from sunbeams and lilac bells, there lived a boy named Gelo. His smile could melt winter frost and his handsome features seemed to carry a pocket full of sunshine. He loved school—the chalk dust, the clack of the eraser, the scribble of numbers on the board—until one morning a silvery spell curled around him and whispered that he could not go to school today.\n\nThe spell felt like a shy friend playing a prank. He stepped toward the gates, but the air grew soft and tugged him back, as if the town itself wanted him to linger outside. Children waved, teachers waved, and yet the spell kept him on the sidewalk, waiting with a brave little ache in his heart for the moment he might join his friends again.",
      illustrationPrompt: "Gelo, a handsome boy with sunlit hair and a bright smile, standing at the edge of a cobblestone village street toward a brick school with ivy and a tall bell tower, a silvery spell curling around him in delicate ribbons, warm morning light, soft pastel colors, chalk dust in the air, fairy-tale village, watercolor illustration style",
      imageUrl: "sample/gelo-storybook/page1.png"
    },
    {
      pageNumber: 2,
      text: "That evening, Miss Lark the library keeper, with spectacles like moth wings, told Gelo a riddle from an old fairy tale: sometimes spells ask for a brighter gift than a quick leap through the gate. The spell would loosen its grip when a heart shared a little sunshine with someone else.\n\nGelo gathered Mira, a map-maker who loved turning streets into stories, and Tiko, a sparrow who spoke in cheerful chirps. They hatched a plan to seek the Whispering Wind beyond the Gate of Dandelion Light, hoping to learn how to untie the spell and walk back into the classroom hand in hand with his friends.",
      illustrationPrompt: "Miss Lark the librarian with round spectacles and a gentle smile, Gelo with Mira the map-maker and Tiko the cheerful sparrow at the village gate, a faint glimmer around the gate, dusk light, lanterns along the street, cozy storybook atmosphere, watercolor illustration style",
      imageUrl: "sample/gelo-storybook/page2.png"
    },
    {
      pageNumber: 3,
      text: "In the moon-shaped meadow beyond the village, the Gate of Glistening Glass shimmered like a bubble ready to pop. A tiny wind-spiral named Lume danced on a ring of petals, listening as Gelo spoke his wish to return to school with a heart full of kindness.\n\nLume offered three bright tokens—Patience, Listening, and Courage—and told them the spell would loosen its grip only when they used these gifts to brighten someone else’s day. The wind whispered that true charm comes from kindness, not glitter alone.\n\nWith tokens clutched tight, Mira sketched a map from memory for a lost child, Gelo lent an ear to a grandmother telling a long, winding story, and Tiko gathered stray dogs and led them home. The meadow glowed softly, as if the land itself were listening for the next brave act.",
      illustrationPrompt: "Moonlit meadow beyond the village, Gate of Glistening Glass shimmering, a tiny wind-spiral named Lume on petals, Gelo holding tokens of Patience, Listening, and Courage, Mira with a map, Tiko the sparrow on his shoulder, sunset glow, whimsical magical realism, watercolor illustration style",
      imageUrl: "sample/gelo-storybook/page3.png"
    },
    {
      pageNumber: 4,
      text: "They hurried back, using the tokens to light small moments of joy: sharing lunch with a hungry boy, helping a shy classmate tie his shoes, and returning a borrowed umbrella to a neighbor who had forgotten it outside in the rain.\n\nEach kind act loosened a thread of the spell until the Gate of the School began to hum softly, a welcome bell in the distance. The spell’s whisper turned warm and playful, as if saying, See? You carry the magic of being yourself, which is enough to come inside.",
      illustrationPrompt: "Group returning to the village with tokens, performing acts: sharing lunch with a hungry boy, helping a shy classmate tie his shoes, returning an umbrella to a neighbor, meadow path with candy mushrooms, midday sun, warm golden light, whimsical storybook style, watercolor",
      imageUrl: "sample/gelo-storybook/page4.png"
    },
    {
      pageNumber: 5,
      text: "Back at the classroom, Gelo stood at the door with Mira and Tiko perched on his shoulder. Miss Lark invited him to tell the class about his journey, and he spoke softly of wind, tokens, and the joy of brightening another’s day rather than simply shining himself.\n\nThe spell’s last shimmer faded into a glow that settled over his chest like a cozy scarf. He realized the true magic wasn’t keeping him out, but inviting him to bring warmth and listening to his friends. With a grateful grin, he stepped into the room and joined his classmates at their desks.",
      illustrationPrompt: "Inside the classroom, Miss Lark at the chalkboard, Gelo at the door with Mira on his shoulder and Tiko on his other, classmates turning toward him, warm window light, gentle magical glow, watercolor illustration style",
      imageUrl: "sample/gelo-storybook/page5.png"
    },
    {
      pageNumber: 6,
      text: "From that day forward, Gelo’s smile was still bright, but it no longer kept him apart. He used his charm to light up study corners, cheer shy classmates, and remind everyone that kindness is the most powerful spell in any school.\n\nThe gates rang with the school bell, and the village learned that the spell that kept him from school had turned into a spell that allowed him to belong. At the end of the year parade, Gelo stood proudly at the gates, a sunbeam at his feet, ready for another day of learning, laughter, and shared adventures.",
      illustrationPrompt: "Gelo at the school gates, friends and family cheering, sunbeam at his feet, school bell ringing, banner reading 'Kindness is the true magic', festive parade atmosphere, bright daytime light, watercolor/storybook illustration style",
      imageUrl: "sample/gelo-storybook/page6.png"
    }
  ];

  currentPageIndex = 0;
  document.getElementById('bookTitleDisplay').textContent = currentBookTitle;
  renderBook();
  switchView('viewer');
}

async function generateBook() {
  if (!apiKey) {
    alert("Please connect your Pollinations API Key first to generate stories.");
    return;
  }

  const title = document.getElementById('title').value || "The Unknown Journey";
  const genre = document.getElementById('genre').value;
  const numPages = parseInt(document.getElementById('pages').value);
  const idea = document.getElementById('idea').value || "An epic spontaneous adventure.";

  const textModel = document.getElementById('textModel').value;
  const imageModel = document.getElementById('imageModel').value;
  const dimensions = document.getElementById('dimensions').value;
  const imageStyle = document.getElementById('imageStyle') ? document.getElementById('imageStyle').value : "";

  switchView('loadingState');
  updateProgress(5, `Crafting Title...`, "AI is refining your book title");
  document.getElementById('generateBtn').disabled = true;
  document.getElementById('generateBtn').classList.add('opacity-50');

  try {
    const betterTitle = await regenerateTitle(title, genre, idea);
    currentBookTitle = betterTitle;

    updateProgress(10, `Brainstorming... (${textModel})`, "Consulting the LLM for the plot");

    const systemPrompt = `You are a master storyteller writing a ${genre} storybook for a premium app.
    Respond ONLY with a JSON object containing a "pages" array.
    Each page object must have: "pageNumber" (1 to ${numPages}), "text" (2-3 engaging paragraphs), and "illustrationPrompt" (detailed comma-separated visual description of the scene for an AI image generator, focus on subject, environment, lighting, and style).`;

    const userPrompt = `Title: "${betterTitle}". Core Idea: ${idea}. Total exact pages: ${numPages}. Write the complete storybook.`;

    const storyData = await fetchStoryContent(userPrompt, systemPrompt, textModel);

    if (!storyData.pages || storyData.pages.length === 0) throw new Error("Invalid story structure generated");
    pages = storyData.pages;

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
      document.getElementById('bookTitleDisplay').textContent = betterTitle;
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
    <div class="flex-1 border-b md:border-b-0 md:border-r border-zinc-800 relative bg-black flex items-center justify-center p-4 img-container">
      <div class="absolute inset-0 bg-cover bg-center opacity-30 blur-xl" style="background-image: url('${page.imageUrl}')"></div>
      <button class="fullscreen-img-btn" onclick="openFullscreen('${page.imageUrl}')" title="View Fullscreen">
        <i class="fa-solid fa-expand"></i>
      </button>
      <img src="${page.imageUrl}" onerror="this.src='https://via.placeholder.com/1024?text=Image+Generating...'" class="relative z-10 w-full max-h-[50vh] md:max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/10 cursor-zoom-in" alt="Illustration" onclick="openFullscreen('${page.imageUrl}')">
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

function openFullscreen(imageUrl) {
  const overlay = document.getElementById('fullscreenOverlay');
  const img = document.getElementById('fullscreenImage');
  img.src = imageUrl;
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeFullscreen() {
  const overlay = document.getElementById('fullscreenOverlay');
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

async function downloadZip() {
  if (!pages || pages.length === 0) {
    alert("No book generated yet. Generate a book first!");
    return;
  }

  const saveBtn = document.getElementById('saveBtn');
  const saveBtnText = document.getElementById('saveBtnText');
  saveBtn.classList.add('save-loading');
  saveBtnText.textContent = 'Packing...';

  try {
    const zip = new JSZip();
    const bookFolder = zip.folder(currentBookTitle || "PollenPages-Book");

    bookFolder.file("info.txt", `Book Title: ${currentBookTitle}\nGenerated by PollenPages (pollinations.ai)\nPages: ${pages.length}\nDate: ${new Date().toLocaleDateString()}\n`);

    for (let i = 0; i < pages.length; i++) {
      saveBtnText.textContent = `Page ${i + 1}/${pages.length}...`;

      const pageText = `=== Page ${i + 1} ===\n\n${pages[i].text}\n\n--- Illustration Prompt ---\n${pages[i].illustrationPrompt}`;
      bookFolder.file(`page${i + 1}.txt`, pageText);

      try {
        const response = await fetch(pages[i].imageUrl);
        if (response.ok) {
          const blob = await response.blob();
          bookFolder.file(`page${i + 1}.png`, blob);
        } else {
          bookFolder.file(`page${i + 1}_error.txt`, `Image failed to download for page ${i + 1}`);
        }
      } catch (imgErr) {
        console.warn(`Failed to download image for page ${i + 1}:`, imgErr);
        bookFolder.file(`page${i + 1}_error.txt`, `Image failed to download: ${imgErr.message}`);
      }
    }

    saveBtnText.textContent = 'Zipping...';
    const content = await zip.generateAsync({ type: "blob" });

    const safeName = (currentBookTitle || "PollenPages-Book").replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
    saveAs(content, `${safeName}.zip`);

    saveBtnText.textContent = 'Save ZIP';
    saveBtn.classList.remove('save-loading');

  } catch (err) {
    console.error("ZIP download failed:", err);
    alert("Failed to create ZIP. Please try again.");
    saveBtnText.textContent = 'Save ZIP';
    saveBtn.classList.remove('save-loading');
  }
}
