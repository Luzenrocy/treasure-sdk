<template>
  <div class="app">
    <h1>{{ title }}</h1>
    <p>插件已加载</p>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'App',
  data() {
    return {
      title: '我的插件',
    };
  },
});
</script>

<style>
html, body, #app { width: 100%; height: 100%; margin: 0; }
* { box-sizing: border-box; }
.app { display: flex; flex-direction: column; height: 100%; padding: 20px; font-family: sans-serif; }
</style>
