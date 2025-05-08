/* 
   BU KOD SADECE GELİŞTİRME VE DENEYİM AMAÇLIDIR.
*/

/* Global Yardımcılar ve Sabitler */
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
const OPENROUTER_API_BASE_URL = 'https://openrouter.ai/api/v1'; 
const OPENROUTER_REFERRER = window.location.href || "http://localhost"; 
const OPENROUTER_TITLE = "Novter AI V1.0"; 

// Saklanan API Anahtarları
let storedApiKeys = {
    gemini: null,
    openrouter: null
};

// DOM Elementleri
const toastArea = $('#toastArea');
const toastMessage = toastArea ? toastArea.querySelector('.toast-message') : null;
const toastSpinner = toastArea ? toastArea.querySelector('.toast-spinner') : null;

const providerSelect = $('#providerSelect'); 
const apiSettingsSection = $('.api-settings'); 

const geminiApiKeyInput = $('#geminiApiKey');
const openrouterApiKeyInput = $('#openrouterApiKey');
const geminiApiKeyField = $('#geminiApiKeyField');
const openrouterApiKeyField = $('#openrouterApiKeyField');

const modelSelect = $('#modelSelect');
const btnLoadModels = $('#btnLoadModels'); 
const temperatureSlider = $('#temperatureSlider');
const temperatureValueSpan = $('#temperatureValue');

const codeEditorTextarea = $('#codeRaw');
const livePreviewFrame = $('#livePreviewFrame');
const btnCopyCode = $('#btnCopyCode');
const btnDownloadCode = $('#btnDownloadCode');
const btnClearCode = $('#btnClearCode');
const btnExplainCode = $('#btnExplainCode'); 
const btnImproveCode = $('#btnImproveCode'); 

const markdownInput = $('#markdownInput');
const markdownPreviewOutput = $('#markdownPreviewOutput');
const btnClearText = $('#btnClearText');
const btnSummarizeText = $('#btnSummarizeText'); 
const btnExpandText = $('#btnExpandText'); 

const promptHelperInput = $('#promptHelperInput');
const btnGeneratePrompt = $('#btnGeneratePrompt');
const promptHelperOutput = $('#promptHelperOutput');
const btnClearPromptHelper = $('#btnClearPromptHelper');

const imageSubjectInput = $('#imageSubjectInput');
const btnGenerateImagePrompt = $('#btnGenerateImagePrompt');
const imagePromptOutput = $('#imagePromptOutput');
const btnClearImagePrompt = $('#btnClearImagePrompt');

const historyPane = $('#historyPane'); 
const historyList = $('#historyList'); 
const btnClearHistory = $('#btnClearHistory'); 

const tabsContainer = $('.tabs-navigation');
const tabs = [...$$('.tab-button')];
const tabIndicator = $('.tab-indicator');
const contentPanes = {
  codePane: $('#codePane'),
  textPane: $('#textPane'),
  promptBuilderPane: $('#promptBuilderPane'),
  imagePromptPane: $('#imagePromptPane'),
  historyPane: $('#historyPane') 
};

const userInput = $('#userInput');
const btnSendRequest = $('#btnSendRequest');
const btnSendRequestText = btnSendRequest ? btnSendRequest.querySelector('.button-text') : null;
const btnSendRequestLoader = btnSendRequest ? btnSendRequest.querySelector('.button-loader') : null;

const themeToggleBtn = $('#themeToggleBtn'); 
const sunIcon = themeToggleBtn ? themeToggleBtn.querySelector('.sun-icon') : null;
const moonIcon = themeToggleBtn ? themeToggleBtn.querySelector('.moon-icon') : null;


let codeMirrorEditor;

/* Toast (Bildirim) Fonksiyonları */
const showToast = (message, type = 'info', duration = 4000) => {
  if (!toastArea || !toastMessage || !toastSpinner) {
    console.error("Toast elementleri DOM'da bulunamadı. Mesaj:", message);
    return;
  }
  toastMessage.textContent = message;
  toastArea.className = 'toast';
  toastSpinner.style.display = 'block';

  if (type === 'success') toastArea.classList.add('success');
  else if (type === 'error') toastArea.classList.add('error');
  else if (type === 'warning') toastArea.classList.add('warning');
  else if (type === 'info') toastArea.classList.add('info'); 
  else toastArea.classList.remove('success', 'error', 'warning', 'info');
  
  if (type !== 'info' && !toastArea.classList.contains('toast-info')) { 
       toastSpinner.style.display = 'none';
  }
  
  toastArea.classList.remove('hidden');

  if (type !== 'info') { 
    setTimeout(() => {
      toastArea.classList.add('hidden');
    }, duration);
  }
};

/* Metin İşleme Yardımcıları */
const stripMarkdownTicks = (text = '') => String(text).replace(/^```[\w-]*\n|```$/gm, '').trim();
const isCodeMirrorInstance = (obj) => obj && typeof obj.replaceRange === 'function';

const typeWriterEffect = (targetElement, textToType, charDelay = 50, initialDelay = 0) => {
  return new Promise(resolve => {
    if (!targetElement) {
        console.error("Typewriter hedef elementi bulunamadı.");
        resolve(); return;
    }
    let charIndex = 0;
    const safeTextToType = String(textToType || '');

    if (isCodeMirrorInstance(targetElement)) targetElement.setValue('');
    else targetElement.value = '';
    
    if (charDelay <= 0) {
        if (isCodeMirrorInstance(targetElement)) {
            targetElement.setValue(safeTextToType);
            if (targetElement.getScrollInfo().height > targetElement.getScrollInfo().clientHeight) {
                targetElement.scrollTo(null, targetElement.getScrollInfo().height);
            }
            targetElement.refresh();
        } else {
            targetElement.value = safeTextToType;
            if (targetElement.scrollHeight > targetElement.clientHeight) {
                targetElement.scrollTop = targetElement.scrollHeight;
            }
        }
        if (targetElement === markdownInput) updateMarkdownPreview();
        resolve(); return;
    }
    function typeChar() {
      if (charIndex < safeTextToType.length) {
        const char = safeTextToType[charIndex];
        if (isCodeMirrorInstance(targetElement)) {
          targetElement.replaceRange(char, targetElement.posFromIndex(targetElement.getValue().length));
          if (targetElement.getScrollInfo().height > targetElement.getScrollInfo().clientHeight) {
            targetElement.scrollTo(null, targetElement.getScrollInfo().height);
          }
        } else {
          targetElement.value += char;
          if (targetElement.scrollHeight > targetElement.clientHeight) {
            targetElement.scrollTop = targetElement.scrollHeight;
          }
        }
        if (targetElement === markdownInput) updateMarkdownPreview();
        charIndex++;
        setTimeout(typeChar, charDelay);
      } else {
        if (isCodeMirrorInstance(targetElement)) targetElement.refresh();
        resolve();
      }
    }
    setTimeout(typeChar, initialDelay);
  });
};

/* CodeMirror Kurulumu */
function initializeCodeMirror() {
  if (!codeEditorTextarea) {
    console.error("CodeMirror için hedef textarea (#codeRaw) DOM'da bulunamadı.");
    return;
  }
  if (typeof CodeMirror === 'undefined' || typeof CodeMirror.fromTextArea !== 'function') {
    console.error("CodeMirror kütüphanesi düzgün yüklenmemiş/tanımlanmamış.");
    const editorWrapper = $('.cm-editor-wrapper');
    if (editorWrapper) editorWrapper.innerHTML = '<p style="color: var(--error-color); padding: 20px; text-align: center;">Kod editörü yüklenemedi. İnternet bağlantınızı kontrol edin veya sayfayı yenileyin.</p>';
    return;
  }
  try {
    codeMirrorEditor = CodeMirror.fromTextArea(codeEditorTextarea, {
      mode: 'htmlmixed', theme: 'material-darker', lineNumbers: true,
      tabSize: 2, autoCloseBrackets: true, autoCloseTags: true, matchBrackets: true,
      styleActiveLine: true, 
      lineWrapping: true 
    });
    if (codeMirrorEditor) {
      codeMirrorEditor.setSize('100%', '100%');
      updateLivePreview();
      codeMirrorEditor.on('change', updateLivePreview);
      codeMirrorEditor.on("cursorActivity", updateCodeActionButtons);
      updateCodeActionButtons(); 
    } else {
      console.error("CodeMirror.fromTextArea bir editör nesnesi döndürmedi.");
      showToast("Kod editörü oluşturulamadı.", "error");
    }
  } catch (e) {
    console.error("CodeMirror başlatılırken bir hata oluştu:", e);
    showToast(`Kod editörü başlatma hatası: ${e.message}`, "error", 6000);
  }
}

function updateLivePreview() {
  if (livePreviewFrame && codeMirrorEditor && typeof codeMirrorEditor.getValue === 'function') {
    try {
        livePreviewFrame.srcdoc = codeMirrorEditor.getValue();
    } catch (e) {
        console.error("Canlı önizleme güncellenirken hata:", e);
        livePreviewFrame.srcdoc = `<p style="color:red; padding:10px;">Önizleme oluşturulurken bir hata oluştu.</p>`;
    }
  }
}

/* Sekme Yönetimi */
function activateTab(targetPaneId) {
  if (!tabs.length || !tabIndicator || !tabsContainer) {
    console.warn("Sekme yönetimi için DOM elementleri eksik.");
    return;
  }
  let activeTabIndex = -1;
  let activeTabElement = null;

  tabs.forEach((tab, index) => {
    const isActive = tab.dataset.opensPane === targetPaneId;
    tab.classList.toggle('active', isActive);
    if (isActive) {
        activeTabIndex = index;
        activeTabElement = tab;
    }
  });

  Object.entries(contentPanes).forEach(([paneKey, paneElement]) => {
    if (paneElement) paneElement.classList.toggle('hidden', paneKey !== targetPaneId);
  });

  if (activeTabElement && tabs.length > 0) {
      requestAnimationFrame(() => { 
          const tabWidth = activeTabElement.offsetWidth;
          const tabLeftOffset = activeTabElement.offsetLeft;
          tabIndicator.style.width = `${tabWidth}px`; 
          tabIndicator.style.transform = `translateX(${tabLeftOffset}px)`; 
      });
  } else {
     tabIndicator.style.width = `${100 / (tabs.length || 1)}%`;
     tabIndicator.style.transform = `translateX(0%)`;
  }

  const currentProvider = providerSelect ? providerSelect.value : 'gemini';
  const apiKeyPresent = storedApiKeys[currentProvider] !== null;
  const modelEffectivelySelected = modelSelect && modelSelect.value && modelSelect.value !== "";
  const isGenerativeTab = targetPaneId === 'codePane' || targetPaneId === 'textPane';

  if (userInput) userInput.disabled = !isGenerativeTab || !modelEffectivelySelected || !apiKeyPresent;
  if (btnSendRequest) btnSendRequest.disabled = !isGenerativeTab || !modelEffectivelySelected || !apiKeyPresent;
  
  updateCodeActionButtons();
  updateTextActionButtons();

  if (targetPaneId === 'codePane' && codeMirrorEditor && typeof codeMirrorEditor.refresh === 'function') {
    requestAnimationFrame(() => codeMirrorEditor.refresh());
  }
  if (targetPaneId === 'historyPane') {
      loadHistory();
  }
}


/* OpenRouter Modellerini Çek */
async function fetchOpenRouterModels() {
    showToast('OpenRouter modelleri alınıyor...', 'info');
    try {
        const response = await fetch(`${OPENROUTER_API_BASE_URL}/models`); 
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenRouter model listesi alınamadı (HTTP ${response.status}): ${errorData.error?.message || 'Bilinmeyen hata'}`);
        }
        const data = await response.json();
        return data.data || []; 
    } catch (error) {
        console.error("OpenRouter modelleri alınırken hata:", error);
        showToast(`OpenRouter modelleri alınamadı: ${error.message}`, 'error', 6000);
        return []; 
    }
}


/* Model Yükleme Fonksiyonu (GÜNCELLENDİ - Dinamik OpenRouter) */
async function loadModels() {
  const selectedProvider = providerSelect ? providerSelect.value : 'gemini';
  const apiKeyInputToUse = selectedProvider === 'gemini' ? geminiApiKeyInput : openrouterApiKeyInput;
  
  if (!apiKeyInputToUse || !modelSelect || (selectedProvider === 'gemini' && !btnLoadModels)) {
    console.error("Model yükleme için gerekli DOM elementleri eksik.");
    return;
  }
  
  const apiKey = apiKeyInputToUse.value.trim();
  // OpenRouter için API key model listelemek için gerekli değil, ama kullanmak için evet.
  // Gemini için API key listelemek için gerekli.
  if (!apiKey && selectedProvider === 'gemini') { 
    showToast(`Lütfen ${selectedProvider === 'gemini' ? 'Gemini' : 'OpenRouter'} API anahtarınızı girin.`, 'error');
    return;
  }
  
  // Anahtarı sakla (OpenRouter için boş olabilir ama yine de saklayalım)
  if(apiKey) { // Sadece doluysa sakla
      storedApiKeys[selectedProvider] = apiKey;
  }

  modelSelect.disabled = true;
  modelSelect.innerHTML = '<option value="">Modeller yükleniyor...</option>';
  if (btnLoadModels) btnLoadModels.disabled = true; 

  try {
    let modelsToList = [];
    if (selectedProvider === 'gemini') {
       if (!storedApiKeys.gemini) throw new Error("Gemini API Anahtarı gerekli.");
       showToast('Gemini modelleri yükleniyor...', 'info');
       const response = await fetch(`${GEMINI_API_BASE_URL}?key=${storedApiKeys.gemini}`);
       if (!response.ok) {
         storedApiKeys.gemini = null; 
         const errorData = await response.json().catch(() => ({}));
         let errorMsg = errorData.error?.message || `Model listesi alınamadı (HTTP ${response.status})`;
         if (response.status === 400 && errorMsg.toLowerCase().includes("api key not valid")) errorMsg = "Geçersiz Gemini API Anahtarı.";
         throw new Error(errorMsg);
       }
       const data = await response.json();
       modelsToList = (data.models || [])
           .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
           .map(m => ({ value: m.name.split('/')[1], display: m.name.split('/')[1] })) 
           .sort((a, b) => a.display.localeCompare(b.display));
       showToast('Gemini modelleri başarıyla yüklendi!', 'success');
        apiKeyInputToUse.value = ''; // Başarılıysa input'u temizle

    } else if (selectedProvider === 'openrouter') {
       const openRouterApiModels = await fetchOpenRouterModels();
       if (openRouterApiModels.length > 0) {
            modelsToList = openRouterApiModels
                // Sadece 'name' alanı olanları ve popüler context length'leri filtrele (isteğe bağlı)
                .filter(m => m.name && m.context_length && m.context_length >= 8000) 
                .map(m => ({ value: m.id, display: m.name || m.id })) 
                .sort((a, b) => a.display.localeCompare(b.display));
            showToast(`OpenRouter modelleri başarıyla yüklendi (${modelsToList.length} model).`, 'success');
       } else {
           showToast('OpenRouter modelleri API\'den alınamadı, popüler liste kullanılıyor.', 'warning', 5000);
           modelsToList = OPENROUTER_MODELS; 
       }
        // OpenRouter için API key input'unu temizle (eğer doluysa)
        if(apiKeyInputToUse.value) { 
             storedApiKeys.openrouter = apiKeyInputToUse.value.trim(); // Sakla
             apiKeyInputToUse.value = ''; 
        } 
        // OpenRouter için API key zorunlu olmasa da, eğer saklanmamışsa uyar
        if (!storedApiKeys.openrouter) {
           showToast('OpenRouter modelleri listelendi, ancak kullanmak için API anahtarı gerekli.', 'warning', 5000);
       }
    }

    // Model listesini doldur
    if (modelsToList.length === 0) {
      storedApiKeys[selectedProvider] = null; 
      modelSelect.innerHTML = '<option value="">Uygun model bulunamadı.</option>';
      showToast(`API anahtarınızla uyumlu ${selectedProvider} modeli bulunamadı.`, 'error');
    } else {
      modelSelect.innerHTML = `<option value="" disabled selected>Bir ${selectedProvider === 'gemini' ? 'Gemini' : 'OpenRouter'} Modeli Seçin</option>` +
        modelsToList.map(m => `<option value="${m.value}">${m.display}</option>`).join('');
      modelSelect.disabled = false;
    }
     
  } catch (error) {
    storedApiKeys[selectedProvider] = null; 
    console.error(`${selectedProvider} model yükleme hatası:`, error);
    showToast(`Hata: ${error.message}`, 'error', 6000);
    modelSelect.innerHTML = '<option value="">Modeller yüklenemedi</option>';
  } finally {
    if (btnLoadModels) btnLoadModels.disabled = false; 
    activateTab(tabs.find(t => t.classList.contains('active'))?.dataset.opensPane || 'codePane'); 
  }
}


/* Genel API Çağrı Fonksiyonu */
async function callApi(promptText, systemInstruction = null, currentTemperature = 0.7) {
    const selectedProvider = providerSelect ? providerSelect.value : 'gemini';
    const apiKey = storedApiKeys[selectedProvider];
    const selectedModel = modelSelect ? modelSelect.value : null;

    if (!apiKey) throw new Error(`${selectedProvider === 'gemini' ? 'Gemini' : 'OpenRouter'} API anahtarı ayarlanmamış.`);
    if (!selectedModel) throw new Error('Lütfen bir model seçin.');

    let apiUrl, requestBody, headers;

    if (selectedProvider === 'gemini') {
        apiUrl = `${GEMINI_API_BASE_URL}${selectedModel}:generateContent?key=${apiKey}`;
        const fullPrompt = systemInstruction ? `${systemInstruction}\n\n---KULLANICI İSTEĞİ---\n${promptText}` : promptText;
        requestBody = { 
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: { temperature: currentTemperature }
        };
        headers = { 'Content-Type': 'application/json' };
    } else if (selectedProvider === 'openrouter') {
        apiUrl = `${OPENROUTER_API_BASE_URL}/chat/completions`; 
        const messages = [];
        if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
        messages.push({ role: "user", content: promptText });
        requestBody = { 
            model: selectedModel, 
            messages: messages,
            temperature: currentTemperature 
        };
        headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': OPENROUTER_REFERRER,
            'X-Title': OPENROUTER_TITLE
        };
    } else {
        throw new Error("Geçersiz AI sağlayıcısı seçildi.");
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: "API'den dönen hata JSON formatında değil veya okunamadı." } }));
            let errorMsg = errorData.error?.message || `Bilinmeyen API Hatası (HTTP ${response.status})`;
            if (response.status === 429) errorMsg = `Kota aşıldı (Hata 429). (Detay: ${errorMsg})`;
            else if (response.status === 401) errorMsg = `Yetkilendirme Hatası (Hata 401). API Anahtarı geçersiz. (Detay: ${errorMsg})`;
            else if (response.status === 400) errorMsg = `Geçersiz İstek (Hata 400). (Detay: ${errorMsg})`;
            else if (response.status >= 500) errorMsg = `Sunucu Hatası (Hata ${response.status}). (Detay: ${errorMsg})`;
            
            if (response.status === 401 || (response.status === 400 && errorMsg.toLowerCase().includes("api key not valid"))) {
                 errorMsg = `Saklanan ${selectedProvider === 'gemini' ? 'Gemini' : 'OpenRouter'} API Anahtarı geçersiz. Lütfen tekrar girin.`;
                 storedApiKeys[selectedProvider] = null; 
                 activateTab(tabs.find(t => t.classList.contains('active'))?.dataset.opensPane || 'codePane'); 
            }
            console.error("API Error Full Data:", errorData);
            throw new Error(errorMsg);
        }

        const data = await response.json();
        let responseText = '';
        if (selectedProvider === 'gemini') {
            const candidate = data.candidates?.[0];
             if (!candidate) {
                if (data.promptFeedback?.blockReason) throw new Error(`İstek engellendi: ${data.promptFeedback.blockReason}.`);
                throw new Error("Modelden geçerli bir yanıt alınamadı (aday bulunamadı).");
            }
            if (candidate.finishReason && candidate.finishReason !== "STOP" && candidate.finishReason !== "MAX_TOKENS") throw new Error(`İçerik üretimi tamamlanamadı. Sebep: ${candidate.finishReason}.`);
            responseText = candidate.content?.parts?.[0]?.text || '';
        } else if (selectedProvider === 'openrouter') {
            responseText = data.choices?.[0]?.message?.content || '';
            if (!responseText && data.error) throw new Error(`OpenRouter Hatası: ${data.error.message}`);
        }
        return responseText;

    } catch (error) {
        console.error(`${selectedProvider} API çağrısı hatası:`, error);
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
           throw new Error("Ağ hatası veya API isteği zaman aşımına uğradı. İnternet bağlantınızı ve API endpoint'ini kontrol edin.");
        }
        throw error; 
    }
}


/* Ana İstek Gönderme Fonksiyonu */
async function handleUserRequest(action = 'generate', context = null) {
  if (!userInput || !btnSendRequest || !modelSelect || !btnSendRequestText || !btnSendRequestLoader || !providerSelect || !temperatureSlider) {
    console.error("Ana istek için DOM elementleri eksik.");
    showToast("Arayüz hatası: Gerekli buton veya alanlar bulunamadı.", "error");
    return;
  }
  
  const currentProvider = providerSelect.value;
  if (!storedApiKeys[currentProvider]) {
      showToast(`${currentProvider === 'gemini' ? 'Gemini' : 'OpenRouter'} API anahtarı ayarlanmamış.`, 'error', 5000);
      return;
  }
   if (!modelSelect.value) { showToast('Lütfen bir model seçin.', 'error'); return; }

  const userRequestText = (action === 'generate') ? userInput.value.trim() : context; 
  if (!userRequestText && action !== 'generate') { showToast('İşlem yapılacak metin veya kod bulunamadı.', 'warning'); return; }
  if (!userRequestText && action === 'generate') { showToast('Lütfen bir istek girin.', 'error'); return; }


  const activePaneId = tabs.find(tab => tab.classList.contains('active'))?.dataset.opensPane;
  if (!activePaneId) { console.error("Aktif sekme bulunamadı."); return; }

  let systemInstruction = '', targetOutputElement, outputCharDelay = 15; 
  let promptForApi = userRequestText; 

  switch (action) {
      case 'generate':
          if (activePaneId === 'codePane') {
              systemInstruction = `Sen uzman bir frontend geliştiricisin. Kullanıcının isteğine göre, sadece ve sadece tam, çalışır ve modern HTML, CSS ve JavaScript kodunu döndür. CSS kodunu <style> etiketleri içinde, JS kodunu ise <script> etiketleri içinde ver. Açıklama yapma, markdown formatı kullanma, sadece ham kodu ver. Eğer kullanıcı spesifik bir HTML yapısı istemezse, temel bir <!DOCTYPE html> ile başlayan tam bir HTML sayfası oluştur.`;
              targetOutputElement = codeMirrorEditor; outputCharDelay = 0;
          } else if (activePaneId === 'textPane') {
              systemInstruction = `Sen deneyimli bir Türkçe içerik yazarısın. Kullanıcının isteğine göre sadece istenen metni, açıklama yapmadan, Markdown formatında döndür. Cevabın akıcı, dilbilgisi kurallarına uygun ve kullanıcı dostu olmalı.`;
              targetOutputElement = markdownInput; outputCharDelay = 15;
          } else { return; } 
          break;
      case 'explain':
          systemInstruction = "Aşağıdaki kodu adım adım, anlaşılır bir Türkçe ile açıkla. Açıklamayı Markdown formatında yap.";
          promptForApi = `Açıklanacak Kod:\n\`\`\`\n${userRequestText}\n\`\`\``;
          targetOutputElement = markdownInput; 
          activateTab('textPane'); 
          break;
      case 'improve':
          systemInstruction = "Aşağıdaki kodu analiz et ve daha okunabilir, performanslı veya modern hale getirmek için iyileştirilmiş versiyonunu döndür. Sadece güncellenmiş tam kodu döndür, açıklama yapma.";
           promptForApi = `İyileştirilecek Kod:\n\`\`\`\n${userRequestText}\n\`\`\``;
          targetOutputElement = codeMirrorEditor; outputCharDelay = 0;
          break;
      case 'summarize':
           systemInstruction = "Aşağıdaki metni ana fikirlerini koruyarak Türkçe olarak özetle. Özeti Markdown formatında ver.";
           promptForApi = `Özetlenecek Metin:\n${userRequestText}`;
           targetOutputElement = markdownInput; outputCharDelay = 15;
           break;
      case 'expand':
            systemInstruction = "Aşağıdaki metni daha detaylı ve açıklayıcı hale getirerek Türkçe olarak genişlet. Genişletilmiş metni Markdown formatında ver.";
            promptForApi = `Genişletilecek Metin:\n${userRequestText}`;
            targetOutputElement = markdownInput; outputCharDelay = 15;
            break;
      default:
          console.error("Bilinmeyen aksiyon:", action);
          return;
  }

  // UI güncellemelerini başlat
  btnSendRequest.disabled = true;
  userInput.disabled = true;
  disableActionButtons(true); 
  btnSendRequestText.textContent = "İşleniyor...";
  btnSendRequestLoader.classList.remove('hidden');
  btnSendRequest.classList.add('loading');
  showToast('Yapay zeka isteğinizi işliyor...', 'info'); // Bu mesaj görünmeli
  
  // Geçmişe kaydet
  if (action === 'generate' && userInput.value.trim()) {
      saveHistory(userInput.value.trim());
  }

  try {
    // API çağrısını yap (UI güncellemelerinden sonra)
    const currentTemperature = parseFloat(temperatureSlider.value);
    const rawApiResponse = await callApi(promptForApi, systemInstruction, currentTemperature); 
    let processedResponse = rawApiResponse;
    
    if (action === 'improve' || (action === 'generate' && activePaneId === 'codePane')) {
        processedResponse = stripMarkdownTicks(rawApiResponse);
    }
    
    if (!processedResponse.trim()) {
      processedResponse = (action === 'generate' && activePaneId === 'codePane') || action === 'improve' ? '' : 'Modelden bir yanıt alınamadı veya yanıt boş.';
      showToast('Modelden boş yanıt alındı.', 'warning', 5000);
    } else {
       showToast('İçerik başarıyla oluşturuldu!', 'success', 3000);
    }
    
    await typeWriterEffect(targetOutputElement, processedResponse, outputCharDelay);
    if (action === 'generate') userInput.value = ''; 

  } catch (error) {
    console.error(`${action} işlemi sırasında hata:`, error);
    showToast(`Hata: ${error.message}`, 'error', 10000); 
    const errorMessage = ``;
    if (targetOutputElement === codeMirrorEditor && isCodeMirrorInstance(codeMirrorEditor)) {
        codeMirrorEditor.setValue(codeMirrorEditor.getValue().length > 0 ? codeMirrorEditor.getValue() + `\n\n${errorMessage}` : errorMessage);
    } else if (targetOutputElement) {
        targetOutputElement.value = targetOutputElement.value.length > 0 ? targetOutputElement.value + `\n\n${errorMessage}` : errorMessage;
    }
  } finally {
    // UI'ı normale döndür
    btnSendRequest.disabled = false; 
    userInput.disabled = false; 
    disableActionButtons(false); 
    btnSendRequestText.textContent = "Oluştur";
    btnSendRequestLoader.classList.add('hidden');
    btnSendRequest.classList.remove('loading');
    activateTab(tabs.find(t => t.classList.contains('active'))?.dataset.opensPane || 'codePane'); 
  }
}

/* Prompt Yardımcı Fonksiyonları */
async function generateHelperPrompt(inputElement, outputElement, buttonElement, systemPromptGenerator) {
  if (!inputElement || !outputElement || !buttonElement || !modelSelect || !providerSelect || !temperatureSlider) {
    console.error("Prompt yardımcısı için DOM elementleri eksik.");
    return;
  }
  const inputText = inputElement.value.trim();
  if (!inputText) { showToast('Lütfen bir konu veya açıklama girin.', 'error'); return; }
  if (!modelSelect.value) { showToast('Lütfen bir model seçin.', 'error'); return; }
  
  const currentProvider = providerSelect.value;
   if (!storedApiKeys[currentProvider]) { 
      showToast(`${currentProvider === 'gemini' ? 'Gemini' : 'OpenRouter'} API anahtarı ayarlanmamış.`, 'error', 5000);
      return;
  }

  const originalButtonText = buttonElement.textContent;
  buttonElement.disabled = true;
  buttonElement.textContent = "Oluşturuluyor..."; 
  showToast('Prompt oluşturuluyor...', 'info');
  outputElement.value = '';

  try {
    const systemInstruction = systemPromptGenerator(inputText);
    const currentTemperature = parseFloat(temperatureSlider.value);
    const rawApiResponse = await callApi(inputText, systemInstruction, currentTemperature); 
    const processedResponse = stripMarkdownTicks(rawApiResponse);
    if (!processedResponse.trim()) {
      outputElement.value = 'Modelden bir yanıt alınamadı veya yanıt boş.';
      showToast('Modelden boş yanıt alındı.', 'warning', 5000);
    } else {
      await typeWriterEffect(outputElement, processedResponse, 10);
      showToast('Prompt başarıyla oluşturuldu!', 'success', 3000);
    }
  } catch (error) {
    console.error('Yardımcı prompt hatası:', error);
    showToast(`Hata: ${error.message}`, 'error', 10000);
    outputElement.value = `Hata: ${error.message}`;
  } finally {
    buttonElement.disabled = false;
    buttonElement.textContent = originalButtonText;
  }
}

/* Markdown Önizleme */
function updateMarkdownPreview() {
  if (markdownPreviewOutput && markdownInput) {
    if (typeof marked !== 'undefined' && typeof marked.parse === 'function' && typeof DOMPurify !== 'undefined') {
      try {
        const rawHtml = marked.parse(markdownInput.value || '# Önizleme Alanı\n\n*Markdown* metniniz burada **görünecek**...');
        markdownPreviewOutput.innerHTML = DOMPurify.sanitize(rawHtml);
      } catch (e) {
        markdownPreviewOutput.textContent = "Markdown ayrıştırılırken bir hata oluştu.";
        console.error("Markdown parse error:", e);
      }
    } else if (typeof marked === 'undefined') {
         markdownPreviewOutput.textContent = "Markdown kütüphanesi (marked.js) yüklenemedi.";
    } else if (typeof DOMPurify === 'undefined') {
         markdownPreviewOutput.textContent = "Güvenlik kütüphanesi (DOMPurify) yüklenemedi. Önizleme güvenlik nedeniyle devre dışı.";
    }
  }
}

/* Sağlayıcı Değişikliğini Yönet */
function handleProviderChange() {
    const selectedProvider = providerSelect.value;
    
    if (geminiApiKeyField) geminiApiKeyField.classList.toggle('hidden', selectedProvider !== 'gemini');
    if (openrouterApiKeyField) openrouterApiKeyField.classList.toggle('hidden', selectedProvider !== 'openrouter');
    if (apiSettingsSection) apiSettingsSection.dataset.provider = selectedProvider;

    if (modelSelect) {
        modelSelect.innerHTML = '<option value="">Önce API Key Girin</option>';
        modelSelect.disabled = true;
        if (storedApiKeys[selectedProvider]) {
             loadModels(); 
        }
    }
    
    activateTab(tabs.find(t => t.classList.contains('active'))?.dataset.opensPane || 'codePane');
}

/* Aksiyon Butonlarını Etkinleştir/Devre Dışı Bırak */
function disableActionButtons(disable) {
    [btnExplainCode, btnImproveCode, btnSummarizeText, btnExpandText].forEach(btn => {
        if (btn) btn.disabled = disable;
    });
    // Özel durumlar için butonları ayrıca güncelle
    updateCodeActionButtons();
    updateTextActionButtons();
}

/* Kod Aksiyon Butonlarını Güncelle */
function updateCodeActionButtons() {
    if (!codeMirrorEditor || !btnExplainCode || !btnImproveCode) return;
    const hasSelection = codeMirrorEditor.somethingSelected();
    const hasContent = codeMirrorEditor.getValue().trim().length > 0;
    // API ve Model seçiliyse ve (seçim varsa VEYA içerik varsa) butonları etkinleştir
    const canEnable = storedApiKeys[providerSelect.value] && modelSelect.value;
    btnExplainCode.disabled = !canEnable || (!hasSelection && !hasContent); // Açıklama için içerik yeterli
    btnImproveCode.disabled = !canEnable || (!hasSelection && !hasContent); // İyileştirme için içerik yeterli
}

/* Metin Aksiyon Butonlarını Güncelle */
function updateTextActionButtons() {
    if (!markdownInput || !btnSummarizeText || !btnExpandText) return;
    const hasText = markdownInput.value.trim().length > 0;
    const canEnable = storedApiKeys[providerSelect.value] && modelSelect.value;
    btnSummarizeText.disabled = !canEnable || !hasText;
    btnExpandText.disabled = !canEnable || !hasText;
}


/* Prompt Geçmişi Yönetimi */
const HISTORY_KEY = 'novterAiHistory';
const MAX_HISTORY_ITEMS = 20; 

function getHistory() {
    try {
        const historyJson = localStorage.getItem(HISTORY_KEY);
        return historyJson ? JSON.parse(historyJson) : [];
    } catch (e) {
        console.error("Geçmiş okunurken hata:", e);
        return [];
    }
}

function saveHistory(promptText) {
    if (!promptText) return;
    let history = getHistory();
    // Aynı prompt zaten varsa, onu silip başa ekle (son kullanılan olsun)
    history = history.filter(item => item !== promptText); 
    history.unshift(promptText); 
    if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(0, MAX_HISTORY_ITEMS);
    }
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
        console.error("Geçmiş kaydedilirken hata:", e);
        showToast("Geçmiş kaydedilemedi (localStorage dolu olabilir).", "warning");
    }
}

function loadHistory() {
    if (!historyList) return;
    const history = getHistory();
    historyList.innerHTML = ''; 
    
    if (history.length === 0) {
        historyList.innerHTML = '<p class="history-empty">Henüz bir istek geçmişi yok.</p>';
    } else {
        history.forEach(prompt => {
            const item = document.createElement('div');
            item.classList.add('history-item');
            item.textContent = prompt;
            item.title = prompt; 
            item.onclick = () => {
                if (userInput) {
                    userInput.value = prompt;
                    // Kullanıcıyı Kod veya Metin sekmesine yönlendir
                    // (Hangisi daha uygunsa veya varsayılan olarak Kod)
                    activateTab('codePane'); 
                    userInput.focus(); // Input alanına odaklan
                    showToast('Prompt input alanına kopyalandı.', 'success', 2000);
                }
            };
            historyList.appendChild(item);
        });
    }
}

function clearHistory() {
    try {
        localStorage.removeItem(HISTORY_KEY);
        loadHistory(); 
        showToast("Geçmiş temizlendi.", "success");
    } catch (e) {
        console.error("Geçmiş temizlenirken hata:", e);
         showToast("Geçmiş temizlenemedi.", "error");
    }
}

/* Tema Yönetimi */
function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('theme-light');
        if(sunIcon) sunIcon.classList.add('hidden');
        if(moonIcon) moonIcon.classList.remove('hidden');
    } else {
        document.body.classList.remove('theme-light');
         if(sunIcon) sunIcon.classList.remove('hidden');
         if(moonIcon) moonIcon.classList.add('hidden');
    }
     // CodeMirror temasını da değiştir (isteğe bağlı, daha fazla CSS gerektirir)
    // if (codeMirrorEditor) {
    //     codeMirrorEditor.setOption("theme", theme === 'light' ? 'default' : 'material-darker');
    // }
}

function toggleTheme() {
    const currentTheme = document.body.classList.contains('theme-light') ? 'light' : 'dark';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    try {
        localStorage.setItem('novterAiTheme', newTheme);
    } catch (e) {
        console.warn("Tema tercihi kaydedilemedi (localStorage kullanılamıyor olabilir).");
    }
}


/* Olay Dinleyicileri (Event Listeners) */
function setupEventListeners() {
  if (providerSelect) providerSelect.onchange = handleProviderChange;
  if (btnLoadModels) btnLoadModels.onclick = loadModels; 
  
  let geminiApiKeyDebounceTimeout;
  if (geminiApiKeyInput && modelSelect) {
    geminiApiKeyInput.oninput = () => {
      clearTimeout(geminiApiKeyDebounceTimeout);
      storedApiKeys.gemini = null; 
      modelSelect.innerHTML = '<option value="">API Key Değiştirildi...</option>';
      modelSelect.disabled = true;
      activateTab(tabs.find(t => t.classList.contains('active'))?.dataset.opensPane || 'codePane');
      geminiApiKeyDebounceTimeout = setTimeout(() => {
        if (geminiApiKeyInput.value.trim()) modelSelect.innerHTML = '<option value="">Modelleri Yükle (Enter)</option>'; 
        else {
          modelSelect.innerHTML = '<option value="">Önce API Key Girin</option>';
          activateTab(tabs.find(t => t.classList.contains('active'))?.dataset.opensPane || 'codePane');
        }
      }, 300); 
    };
    geminiApiKeyInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && geminiApiKeyInput.value.trim()) loadModels(); });
  }
  let openrouterApiKeyDebounceTimeout;
   if (openrouterApiKeyInput && modelSelect) {
    openrouterApiKeyInput.oninput = () => {
      clearTimeout(openrouterApiKeyDebounceTimeout);
      storedApiKeys.openrouter = null; 
      modelSelect.innerHTML = '<option value="">API Key Değiştirildi...</option>';
      modelSelect.disabled = true;
      activateTab(tabs.find(t => t.classList.contains('active'))?.dataset.opensPane || 'codePane');
      openrouterApiKeyDebounceTimeout = setTimeout(() => {
        if (openrouterApiKeyInput.value.trim()) modelSelect.innerHTML = '<option value="">Modelleri Listele (Enter)</option>'; 
        else {
          modelSelect.innerHTML = '<option value="">Önce API Key Girin</option>';
          activateTab(tabs.find(t => t.classList.contains('active'))?.dataset.opensPane || 'codePane');
        }
      }, 300); 
    };
     openrouterApiKeyInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && openrouterApiKeyInput.value.trim()) loadModels(); });
  }

  if (temperatureSlider && temperatureValueSpan) {
      temperatureSlider.oninput = () => { temperatureValueSpan.textContent = temperatureSlider.value; };
  }

  if (modelSelect && userInput) {
    modelSelect.onchange = () => {
      activateTab(tabs.find(t => t.classList.contains('active'))?.dataset.opensPane || 'codePane');
      if (modelSelect.value && modelSelect.options[modelSelect.selectedIndex])
        userInput.placeholder = `"${modelSelect.options[modelSelect.selectedIndex].text}" modeli ile ne istersiniz?`;
      else userInput.placeholder = "Yapay zekadan ne yapmasını istersiniz?";
    };
  }

  tabs.forEach(tab => { if (tab) tab.onclick = () => activateTab(tab.dataset.opensPane); });

  if (btnCopyCode) btnCopyCode.onclick = () => { /* ... */ };
  if (btnDownloadCode) btnDownloadCode.onclick = () => { /* ... */ };
  if (btnClearCode && codeMirrorEditor) btnClearCode.onclick = () => { codeMirrorEditor.setValue(''); updateLivePreview(); showToast('Kod editörü temizlendi.', 'success', 2000); };
  if (btnExplainCode && codeMirrorEditor) btnExplainCode.onclick = () => { handleUserRequest('explain', codeMirrorEditor.getSelection() || codeMirrorEditor.getValue()); };
  if (btnImproveCode && codeMirrorEditor) btnImproveCode.onclick = () => { handleUserRequest('improve', codeMirrorEditor.getSelection() || codeMirrorEditor.getValue()); };

  if (btnClearText && markdownInput) btnClearText.onclick = () => { markdownInput.value = ''; updateMarkdownPreview(); showToast('Metin alanı temizlendi.', 'success', 2000); };
  if (btnSummarizeText && markdownInput) btnSummarizeText.onclick = () => { handleUserRequest('summarize', markdownInput.value); };
  if (btnExpandText && markdownInput) btnExpandText.onclick = () => { handleUserRequest('expand', markdownInput.value); };
  if (markdownInput) markdownInput.addEventListener('input', updateTextActionButtons); 

  if (btnClearPromptHelper && promptHelperInput && promptHelperOutput) btnClearPromptHelper.onclick = () => { promptHelperInput.value = ''; promptHelperOutput.value = ''; showToast('Prompt alanları temizlendi.', 'success', 2000); };
  if (btnClearImagePrompt && imageSubjectInput && imagePromptOutput) btnClearImagePrompt.onclick = () => { imageSubjectInput.value = ''; imagePromptOutput.value = ''; showToast('Görsel prompt alanları temizlendi.', 'success', 2000); };

  if (btnSendRequest && userInput) {
    btnSendRequest.onclick = () => handleUserRequest('generate'); 
    userInput.addEventListener('keypress', (e) => { if (e.key==='Enter' && !userInput.disabled && !btnSendRequest.disabled) { e.preventDefault(); handleUserRequest('generate'); } });
  }

  if (btnGeneratePrompt) btnGeneratePrompt.onclick = () => generateHelperPrompt(promptHelperInput, promptHelperOutput, btnGeneratePrompt, (t) => `Kullanıcının şu girdisine dayanarak etkili, tek paragraftan oluşan, Türkçe bir "Generative AI" metin prompt'u oluştur: "${t}". Prompt, doğrudan modele verilebilecek şekilde, soru cümlesi olmadan, emir kipiyle ve net olmalı. Prompt'un kendisi dışında hiçbir ek açıklama veya metin içermemeli.`);
  if (btnGenerateImagePrompt) btnGenerateImagePrompt.onclick = () => generateHelperPrompt(imageSubjectInput, imagePromptOutput, btnGenerateImagePrompt, (t) => `Aşağıdaki konsept için ultra-gerçekçi, sinematik, 8K çözünürlükte bir görsel oluşturmak üzere tasarlanmış, İngilizce, son derece detaylı ve sanatsal bir AI görsel prompt'u yaz: "${t}". Prompt içerisinde kamera açıları (örn: wide shot, close-up), ışıklandırma detayları (örn: volumetric lighting, golden hour), sanatsal tarzlar (örn: photorealistic, hyperrealistic, cinematic lighting, depth of field, bokeh) ve ince ayrıntılar (örn: doku, materyal, atmosfer) bulunsun. Sadece prompt metnini döndür, başka hiçbir ek açıklama yapma.`);
  
  if (markdownInput) markdownInput.addEventListener('input', updateMarkdownPreview);
  if(btnClearHistory) btnClearHistory.onclick = clearHistory;
  if (themeToggleBtn) themeToggleBtn.onclick = toggleTheme;
}

/* Başlangıç Fonksiyonu */
function initializeApp() {
  if (!document.body || !document.head) {
      console.error("Temel DOM yapısı (body veya head) yüklenemedi.");
      alert("Sayfa yapısı yüklenirken bir sorun oluştu. Lütfen sayfayı yenileyin.");
      return;
  }
  
  // Feather ikonlarını başlat
  feather.replace(); 

  // Kaydedilmiş temayı uygula
  const savedTheme = localStorage.getItem('novterAiTheme') || 'dark'; 
  applyTheme(savedTheme);

  initializeCodeMirror();
  setupEventListeners();
  handleProviderChange(); 
  activateTab('codePane'); 
  updateMarkdownPreview(); 
  updateTextActionButtons(); 
  
  if (modelSelect) {
    modelSelect.innerHTML = '<option value="">Önce Sağlayıcı ve API Key Girin</option>';
    activateTab('codePane'); 
  }
}

if (document.readyState === 'loading') { 
    document.addEventListener('DOMContentLoaded', initializeApp);
} else { 
    initializeApp();
}

