<template>
  <div class="app">
    <h1>{{ title }}</h1>
    <p>SDK 2.0：所有能力返回 Result&lt;T&gt;，文件只能通过用户选择的引用访问。</p>
    <button @click="selectFile">选择文件</button>
    <pre>{{ output }}</pre>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { files } from 'treasure-sdk';

export default defineComponent({
  name: 'App',
  data() {
    return {
      title: '我的插件',
      output: '',
    };
  },
  methods: {
    async selectFile() {
      const selected = await files.openDialog({ kind: 'file', title: '选择文件' });
      if (!selected.ok) { this.output = `${selected.error.code}: ${selected.error.message}`; return; }
      const file = selected.value[0];
      if (!file) return;
      const content = await files.readFile(file);
      this.output = content.ok ? `读取 ${file.name}: ${content.value.byteLength} 字节` : `${content.error.code}: ${content.error.message}`;
    },
  },
});
</script>

<style>
html, body, #app { width: 100%; height: 100%; margin: 0; }
* { box-sizing: border-box; }
.app { display: flex; flex-direction: column; height: 100%; padding: 20px; font-family: sans-serif; }
</style>
