import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 새 버전을 배포하면 다음 실행 때 자동으로 갱신
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Word Pop',
        short_name: 'Word Pop',
        description: '영어·중국어·일본어·스페인어 단어 카드',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f4f5fb',
        theme_color: '#4f46e5',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 화면·단어 데이터(레벨별 JS)를 미리 저장해 오프라인에서도 열리게 함
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        // 로그인/학습기록(Supabase) 요청은 캐시하지 않고 항상 인터넷으로 통신
        navigateFallbackDenylist: [/^\/auth/, /^\/rest/],
      },
    }),
  ],
})
