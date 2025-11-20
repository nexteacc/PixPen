<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.



## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure environment variables in [.env.local](.env.local):
   - `GEMINI_API_KEY`: Your Gemini API key (required)
   - `GEMINI_IMAGE_MODEL`: Model for image editing (optional, defaults to `gemini-2.5-flash-image-preview`)
   - `GEMINI_SEGMENTATION_MODEL`: Model for object segmentation (optional, defaults to `gemini-2.5-flash`)
3. Run the app:
   `npm run dev`
