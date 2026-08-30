// ================================================================
//  请将下方地址替换为你部署的 Worker 地址
// ================================================================
const WORKER_PROXY_URL = "https://ai-api-proxy.dis310.workers.dev";
// ================================================================

const chatBox = document.getElementById('chatBox');
const userInput = document.getElementById('userInput');
const baseUrlInput = document.getElementById('baseUrl');
const apiKeyInput = document.getElementById('apiKey');
const modelNameInput = document.getElementById('modelName');
const workerDisplay = document.getElementById('workerDisplay');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const sendChatBtn = document.getElementById('sendChatBtn');
const newChatBtn = document.getElementById('newChatBtn');
const conversationList = document.getElementById('conversationList');
const activeChatTitle = document.getElementById('activeChatTitle');
const settingsModal = document.getElementById('settingsModal');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');

const CONFIG_KEY = 'aiChatConfig';
const CONVERSATIONS_KEY = 'jetAgentConversations';
const ACTIVE_CONVERSATION_KEY = 'jetAgentActiveConversationId';
const DEFAULT_TITLE = '新对话';

let conversations = loadConversations();
let activeConversationId = localStorage.getItem(ACTIVE_CONVERSATION_KEY);

workerDisplay.textContent = WORKER_PROXY_URL.replace('https://', '');

const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
baseUrlInput.value = saved.baseUrl || 'https://api.deepseek.com/v1/chat/completions';
apiKeyInput.value = saved.apiKey || '';
modelNameInput.value = saved.modelName || 'deepseek-chat';

if (!conversations.length) {
  conversations = [createConversation()];
}

if (!conversations.some((item) => item.id === activeConversationId)) {
  activeConversationId = conversations[0].id;
}

persistConversations();
renderConversationList();
renderActiveConversation();
setStatus('就绪', true);

function createConversation(title = DEFAULT_TITLE) {
  const now = new Date().toISOString();
  return {
    id: `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    createdAt: now,
    updatedAt: now,
    messages: []
  };
}

function loadConversations() {
  try {
    const data = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function persistConversations() {
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  localStorage.setItem(ACTIVE_CONVERSATION_KEY, activeConversationId);
}

function getActiveConversation() {
  return conversations.find((item) => item.id === activeConversationId);
}

function renderConversationList() {
  conversationList.innerHTML = '';

  conversations
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .forEach((conversation) => {
      const row = document.createElement('div');
      row.className = `conversation-row${conversation.id === activeConversationId ? ' active' : ''}`;

      const button = document.createElement('button');
      button.className = 'conversation-item';
      button.type = 'button';
      button.innerHTML = `
        <span class="material-symbols-outlined">chat_bubble</span>
        <div>
          <span class="conversation-title">${escapeHtml(conversation.title)}</span>
          <span class="conversation-time">${formatTime(conversation.updatedAt)}</span>
        </div>
      `;
      button.addEventListener('click', () => switchConversation(conversation.id));

      const deleteButton = document.createElement('button');
      deleteButton.className = 'conversation-delete';
      deleteButton.type = 'button';
      deleteButton.title = '删除对话';
      deleteButton.setAttribute('aria-label', '删除对话');
      deleteButton.innerHTML = '<span class="material-symbols-outlined">close</span>';
      deleteButton.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteConversation(conversation.id);
      });

      row.append(button, deleteButton);
      conversationList.appendChild(row);
    });
}

function renderActiveConversation() {
  const conversation = getActiveConversation();
  if (!conversation) return;

  activeChatTitle.textContent = conversation.title;

  if (!conversation.messages.length) {
    chatBox.innerHTML = '<div class="chat-empty"><span class="material-symbols-outlined">forum</span><span>输入问题开始对话</span></div>';
    return;
  }

  chatBox.innerHTML = '';
  conversation.messages.forEach((message) => {
    appendMessage(message.role, message.content);
  });
  chatBox.scrollTop = chatBox.scrollHeight;
}

function switchConversation(id) {
  activeConversationId = id;
  persistConversations();
  renderConversationList();
  renderActiveConversation();
}

function startNewConversation() {
  const conversation = createConversation();
  conversations.unshift(conversation);
  activeConversationId = conversation.id;
  persistConversations();
  renderConversationList();
  renderActiveConversation();
  userInput.focus();
}

function deleteConversation(id) {
  const removingActive = id === activeConversationId;
  conversations = conversations.filter((conversation) => conversation.id !== id);

  if (!conversations.length) {
    conversations = [createConversation()];
  }

  if (removingActive || !conversations.some((conversation) => conversation.id === activeConversationId)) {
    activeConversationId = conversations[0].id;
  }

  persistConversations();
  renderConversationList();
  renderActiveConversation();
}

function updateConversationTitle(conversation, content) {
  if (conversation.title !== DEFAULT_TITLE) return;
  conversation.title = content.length > 24 ? `${content.slice(0, 24)}...` : content;
}

function saveConfig() {
  const baseUrl = baseUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();
  const modelName = modelNameInput.value.trim();

  if (!baseUrl || !apiKey || !modelName) {
    alert('请完整填写接口地址、API Key 和模型名称');
    return;
  }

  localStorage.setItem(CONFIG_KEY, JSON.stringify({ baseUrl, apiKey, modelName }));
  setStatus('配置已保存', true);
  closeSettings();
}

function clearChat() {
  const conversation = getActiveConversation();
  if (!conversation) return;

  conversation.messages = [];
  conversation.title = DEFAULT_TITLE;
  conversation.updatedAt = new Date().toISOString();
  persistConversations();
  renderConversationList();
  renderActiveConversation();
  setStatus('已清空', false);
}

function setStatus(text, ok = true) {
  statusText.textContent = text;
  statusDot.className = `dot${ok ? '' : ' inactive'}`;
}

async function sendChat() {
  const baseUrl = baseUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();
  const model = modelNameInput.value.trim();
  const content = userInput.value.trim();

  if (!baseUrl || !apiKey || !model) {
    openSettings();
    alert('请先完整填写接口地址、API Key 和模型名称');
    return;
  }

  if (!content) return;

  if (!WORKER_PROXY_URL || WORKER_PROXY_URL.includes('你的用户名')) {
    alert('⚠️ 请先修改代码中的 WORKER_PROXY_URL 为你的 Worker 地址！');
    return;
  }

  const conversation = getActiveConversation();
  if (!conversation) return;

  userInput.value = '';
  if (chatBox.querySelector('.chat-empty')) chatBox.innerHTML = '';

  conversation.messages.push({ role: 'user', content });
  conversation.updatedAt = new Date().toISOString();
  updateConversationTitle(conversation, content);
  activeChatTitle.textContent = conversation.title;
  appendMessage('user', content);

  const aiMessage = { role: 'ai', content: '' };
  conversation.messages.push(aiMessage);
  const aiContentDiv = appendMessage('ai', 'AI 思考中...', true);

  persistConversations();
  renderConversationList();

  const payload = {
    _target: baseUrl,
    model,
    stream: true,
    messages: conversation.messages
      .filter((message) => message.content)
      .map((message) => ({
        role: message.role === 'ai' ? 'assistant' : 'user',
        content: message.content
      }))
  };

  setStatus('请求中...', true);

  try {
    const response = await fetch(WORKER_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errMsg = await response.text();
      throw new Error(`HTTP ${response.status}: ${errMsg.substring(0, 120)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let replyText = '';

    setStatus('接收流式数据...', true);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.replace('data: ', '');
        if (data === '[DONE]') continue;

        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            replyText += delta;
            aiMessage.content = replyText;
            aiContentDiv.innerHTML = renderMarkdown(replyText, true);
            chatBox.scrollTop = chatBox.scrollHeight;
          }
        } catch (_) {
          // 忽略非 JSON 的流式片段
        }
      }
    }

    if (!replyText) {
      aiMessage.content = '(无内容返回)';
      aiContentDiv.innerHTML = renderMarkdown('(无内容返回)', true);
    }

    conversation.updatedAt = new Date().toISOString();
    persistConversations();
    renderConversationList();
    setStatus('就绪', true);
  } catch (error) {
    aiMessage.content = `错误：${error.message}`;
    aiContentDiv.innerHTML = `<span class="error">⚠️ 错误</span> ${escapeHtml(error.message)}`;
    conversation.updatedAt = new Date().toISOString();
    persistConversations();
    renderConversationList();
    setStatus('请求失败', false);
  }
}

function appendMessage(role, content, returnContent = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = `avatar ${role}`;
  avatar.innerHTML = `<span class="material-symbols-outlined">${role === 'user' ? 'person' : 'smart_toy'}</span>`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'msg-content markdown-body';
  contentDiv.innerHTML = role === 'ai' ? renderMarkdown(content, true) : renderMarkdown(content);

  bubble.appendChild(contentDiv);
  messageDiv.append(avatar, bubble);
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;

  return returnContent ? contentDiv : messageDiv;
}

function renderMarkdown(text, withLabel = false) {
  const label = withLabel ? '<span class="msg-label">AI</span>' : '';
  return label + parseMarkdown(text);
}

function parseMarkdown(text) {
  const codeBlocks = [];
  let source = escapeHtml(text).replace(/```([\s\S]*?)```/g, (_, code) => {
    const token = `@@CODE_BLOCK_${codeBlocks.length}@@`;
    codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
    return token;
  });

  source = source
    .replace(/^###### (.*)$/gm, '<h6>$1</h6>')
    .replace(/^##### (.*)$/gm, '<h5>$1</h5>')
    .replace(/^#### (.*)$/gm, '<h4>$1</h4>')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  source = parseLists(source);

  source = source
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^@@CODE_BLOCK_\d+@@$/.test(trimmed)) return trimmed;
      if (/^<(h[1-6]|ul|ol|blockquote|pre)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');

  codeBlocks.forEach((block, index) => {
    source = source.replace(`@@CODE_BLOCK_${index}@@`, block);
  });

  return source;
}

function parseLists(source) {
  const lines = source.split('\n');
  const output = [];
  let listType = null;

  const closeList = () => {
    if (!listType) return;
    output.push(`</${listType}>`);
    listType = null;
  };

  lines.forEach((line) => {
    const unordered = line.match(/^\s*[-*]\s+(.+)/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)/);

    if (unordered || ordered) {
      const nextType = unordered ? 'ul' : 'ol';
      if (listType !== nextType) {
        closeList();
        output.push(`<${nextType}>`);
        listType = nextType;
      }
      output.push(`<li>${unordered ? unordered[1] : ordered[1]}</li>`);
      return;
    }

    closeList();
    output.push(line);
  });

  closeList();
  return output.join('\n');
}

function openSettings() {
  settingsModal.classList.add('open');
  settingsModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => baseUrlInput.focus(), 0);
}

function closeSettings() {
  settingsModal.classList.remove('open');
  settingsModal.setAttribute('aria-hidden', 'true');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(dateText) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

userInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    sendChat();
  }
});

settingsModal.addEventListener('click', function(e) {
  if (e.target === settingsModal) closeSettings();
});

window.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeSettings();
});

saveConfigBtn.addEventListener('click', saveConfig);
clearChatBtn.addEventListener('click', clearChat);
sendChatBtn.addEventListener('click', sendChat);
newChatBtn.addEventListener('click', startNewConversation);
openSettingsBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);
cancelSettingsBtn.addEventListener('click', closeSettings);
