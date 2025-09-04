import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import AutoImport from 'unplugin-auto-import/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [AutoImport({
      dirs: ['src/assets/common'],
      imports: [
        'react',
        {dayjs: [['default', 'dayjs']]}
      ],
      dts: 'src/auto-imports.d.ts',
    }),
    react(), tailwindcss(),
  ],

  resolve: {
    alias: {
      '@common': path.resolve(__dirname, 'src/assets/common/common.js'),
      '@': path.resolve(__dirname, 'src'),
    }
  }
})
