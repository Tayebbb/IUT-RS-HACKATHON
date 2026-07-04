---
title: Office Power Monitor Backend
emoji: ⚡
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Real-time IoT office power monitoring backend with Socket.IO
---

# Office Power Monitor — Backend

Real-time IoT backend for the Office Power Monitor system. Provides:
- REST API for devices, rooms, usage, alerts and incidents
- Socket.IO WebSocket broadcasting for live dashboard updates
- AI-powered anomaly analysis via HuggingFace Inference API
- Automated Eco-Mode engine for energy optimisation

## Environment Variables

Set the following secrets in your Space settings:

| Variable | Description | Required |
|---|---|---|
| `HF_API_TOKEN` | HuggingFace Inference API token for AI analysis | Optional |
| `CORS_ORIGIN` | Vercel frontend URL (e.g. `https://your-app.vercel.app`) | Recommended |
| `HF_MODEL` | Model ID for AI analysis | Optional (default: Mistral-7B) |
