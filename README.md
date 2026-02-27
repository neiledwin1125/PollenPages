# 🍌 PollenPages

> **Premium AI storybook generator for everyone.**  
> Craft immersive, dynamic children's books and fantasy stories by describing an idea, picking a genre, and watching it generate — instantly.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/pollenpages)

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎭 **5 Genre Presets** | Whimsical Fairy Tale, Sci-Fi Adventure, Cyberpunk Mystery, Cozy Fantasy, Educational |
| ⚡ **Automated Generation** | Generate entire storybooks with parallel text and image processing |
| 📖 **Dynamic Page Flips** | Immersive 3D CSS page transitions for a real book-reading experience |
| 🎛️ **Advanced Settings** | Control Aspect Ratios, Art Styles, Text Engines, and Vision Engines directly from the UI |
| 🔑 **Optional API Key** | Bring your own Pollinations API key to unlock premium speed and limits |
| 📱 **Fully Responsive** | Works beautifully on desktop, tablet, and mobile |
| ⏳ **Live Progress Tracking** | Real-time loading indicator tracking the AI's exact progress |

## 🚀 Quick Start

### Deploy to Vercel

1. **Click the button above** → Deploy to Vercel
2. **Done!** Your storybook generator is live 🎉

### Run Locally

```bash
# Clone the repo
git clone https://github.com/yourusername/pollenpages.git
cd pollenpages

# Start local server
npm run dev
# or
npx serve .

# Open http://localhost:3000
```

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   User Input    │────▶│ Pollinations API │────▶│  Text Engine    │
│  (HTML/CSS/JS)  │     │ (gen.pollinations)     │ (openai-fast)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │                           │
                              ▼                           ▼
                        ┌─────────────┐          ┌──────────────┐
                        │ JSON Parsing│          │   Parallel   │
                        │ & Sanitizing│          │   Image Gen  │
                        └─────────────┘          └──────────────┘
                              │                           │
                              ▼                           ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Dynamic UI View │     │ Styled Images    │     │ Immersive Book  │
│ (3D Page Flips) │     │ (Z-Image Turbo)  │     │ Reading UX      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla HTML5, CSS3, JavaScript (ES5 Compatible) |
| **Styling** | Custom CSS Variables, TailwindCSS (CDN) for layout |
| **AI Provider** | [Pollinations.ai](https://pollinations.ai) — Generative Media API |
| **Logic** | Custom async promise management and JSON parsing (No Dependencies) |
| **Fonts** | Outfit, Playfair Display (Google Fonts) |

## 🧠 Advanced Generation System

PollenPages utilizes a highly robust generation pipeline to ensure your stories look and read perfectly every time.

**How it works:**
1. User inputs parameters and PollenPages constructs an advanced system prompt.
2. The payload is sent to the Pollinations `/v1/chat/completions` endpoint enforcing JSON output.
3. Our custom `parseLLMJson()` function sanitizes the response.
4. The system concurrently triggers Pollinations image endpoints, injecting specific Art Style modifiers.
5. Images are pre-loaded blindly to prevent UI layout shifts before rendering.

**UI cues:**
- The generator button is locked during creation to prevent spam.
- A dynamic progress bar calculates time remaining based on page count.

## 🎛️ Parameters

Each genre automatically contextualizes the LLM's system prompt:

| Setting | Options |
|-------|--------------|
| **Text Engine** | OpenAI Fast (Default), Gemini Search, Mistral, Nova Fast, Gemini Fast |
| **Vision Engine** | Z-Image Turbo (Default), Flux Schnell, Imagen 4, Grok Imagine, FLUX.2 Klein 4B/9B, GPT Image 1 Mini |
| **Aspect Ratio** | Square (1x1), Standard (3x4), Landscape (4x3) |
| **Art Style** | Auto/Magic, Comic Book, Anime/Manga, Photorealistic, Watercolor, 3D Render, Cyberpunk, Pixel Art |
| **Length** | 3 to 10 Pages |

## 📂 Project Structure

```
pollenpages/
├── index.html          # Main UI — Hero, generator, viewer
├── css/
│   └── style.css       # Complete design system
├── js/
│   └── app.js          # Application logic — API routing, state management
├── package.json        # Project metadata + dev server scripts
├── vercel.json         # Vercel config — SPA routing, caching, headers
└── README.md           # This document
```

## ⚙️ Configuration

### User Settings

Users can configure app globally:
- **API Key** — Connect Pollinations via OAuth for higher limits and faster generations. (Stored securely in local storage).

## 🔌 API Integration

### `POST /v1/chat/completions`
Generates the core JSON narrative structure. 

### `GET /image/[prompt]`
Generates the accompanying illustrations using advanced query parameters:
`?model={engine}&width={w}&height={h}&nologo=true&enhance=true`

## 🛡️ Security

- **Client-Side Only** — API keys remain locally on the client and are passed directly to endpoints.
- **Dependency-Free Logic** — The core `app.js` functionality does not rely on any third-party libraries.

## 📝 License

MIT

## 🙏 Acknowledgments

- [Pollinations.ai](https://pollinations.ai) — Free AI generation API

---

**Made with ✦ for the Pollinations Community**
