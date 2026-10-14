import { defineConfig, type Preset } from '@vite-pwa/assets-generator/config'

// Regenerate the icons in public/ from public/icon.svg with:
//   npm run generate-pwa-assets -w @bwf/frontend
// The built-in presets pad with white, which shows as a white frame on iOS and
// as white corners once Android crops the maskable icon, so pad with the felt green.
const FELT = '#0b6b3a'

const preset: Preset = {
  transparent: {
    sizes: [64, 192, 512],
    favicons: [[48, 'favicon.ico']],
    padding: 0,
  },
  maskable: {
    sizes: [512],
    // Keep the cards inside Android's safe zone (the central 80% circle).
    padding: 0.3,
    resizeOptions: { background: FELT },
  },
  apple: {
    sizes: [180],
    padding: 0.1,
    resizeOptions: { background: FELT },
  },
}

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset,
  images: ['public/icon.svg'],
})
