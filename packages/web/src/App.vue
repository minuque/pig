<template>
  <div class="app-container">
    <!-- Workspace and Session navigation -->
    <nav class="nav-bar">
      <div class="workspace-header">
        <h1>Workspace</h1>
        <button class="btn btn-primary">Authorize Workspace</button>
      </div>
      <div class="session-list">
        <div class="session-card active">Session 1</div>
        <button class="btn btn-utility">+ New Session</button>
      </div>
    </nav>

    <!-- Main content -->
    <main class="main-content">
      <div class="transcript-area">
        <h2>Session Transcript</h2>
        <div id="transcript" class="transcript-content">
          <!-- Transcript messages -->
          <div class="message prompt">Hello, what can you do?</div>
          <div class="message agent">I can help with coding and more.</div>
          <!-- Streaming simulation -->
          <div id="streaming" class="streaming" style="display: none">
            <div class="message agent streaming-token">Thinking...</div>
          </div>
        </div>
      </div>

      <div class="input-area">
        <textarea placeholder="Enter prompt here..." rows="3"></textarea>
        <button class="btn btn-primary">Send</button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from "vue";
</script>

<style scoped>
.app-container {
  display: grid;
  grid-template-columns: 300px 1fr;
  height: 100vh;
  font-family: var(--font);
}
.nav-bar {
  background: var(--canvas-soft);
  border-right: 1px solid var(--hairline);
  display: flex;
  flex-direction: column;
}
.workspace-header {
  padding: 20px;
}
.session-list {
  flex: 1;
  padding: 20px;
}
.session-card {
  background: white;
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  padding: 15px;
  margin-bottom: 10px;
  cursor: pointer;
}
.main-content {
  display: flex;
  flex-direction: column;
}
.transcript-area {
  flex: 1;
  padding: 20px;
  background: var(--canvas-soft);
  overflow-y: auto;
}
.transcript-content {
  margin-bottom: 30px;
}
.message {
  margin-bottom: 20px;
  padding: 12px 16px;
  border-radius: var(--r-lg);
  max-width: 80%;
}
.message.prompt {
  align-self: flex-end;
  background: var(--surface);
  border: 1px solid var(--hairline);
}
.message.agent {
  align-self: flex-start;
  background: white;
}
.input-area {
  padding: 20px;
  background: white;
  border-top: 1px solid var(--hairline);
}
.btn {
  padding: 10px 20px;
  border-radius: var(--r-full);
  font-size: 15px;
}
.btn-primary {
  background: var(--primary);
  color: white;
}
.btn-utility {
  background: white;
  border: 1px solid var(--hairline);
}
</style>
