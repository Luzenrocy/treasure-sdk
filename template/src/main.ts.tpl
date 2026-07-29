import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import {
  Fold, Expand, Document, Folder,
  DocumentAdd, FolderAdd, Delete, Loading,
} from '@element-plus/icons-vue';
import App from './App.vue';
import { initTreasure } from '@treasure/sdk';

const app = createApp(App);
const icons = { Fold, Expand, Document, Folder, DocumentAdd, FolderAdd, Delete, Loading };
for (const [key, component] of Object.entries(icons)) {
  app.component(key, component);
}
app.use(ElementPlus);
initTreasure();
app.mount('#app');
