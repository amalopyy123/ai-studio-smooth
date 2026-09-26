// ==UserScript==
// @name         AI Studio Focus Mode
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Smooth prompt editor with a local prompt library for Google AI Studio.
// @match        https://aistudio.google.com/*
// @grant        none
// ==/UserScript==

(function () {

    'use strict';

    const STORAGE_KEY =
        'ai-focus-prompt-library-v1';

    let panel = null;
    let textarea = null;
    let promptNameInput = null;
    let promptSearchInput = null;
    let promptList = null;

    let cachedTarget = null;
    let focused = false;
    let activePromptId = null;
    let prompts = [];

    function createPromptId() {

        return (
            'prompt-' +
            Date.now().toString(36) +
            '-' +
            Math.random().toString(36).slice(2, 8)
        );
    }

    function getTimestamp() {

        return new Date().toISOString();
    }

    function formatDate(value) {

        const date =
            new Date(value);

        if (
            Number.isNaN(date.getTime())
        ) {
            return '';
        }

        return date.toLocaleString(
            undefined,
            {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }
        );
    }

    function loadPrompts() {

        try {

            const raw =
                localStorage.getItem(STORAGE_KEY);

            const parsed =
                raw
                    ? JSON.parse(raw)
                    : [];

            prompts =
                Array.isArray(parsed)
                    ? parsed.filter((item) => {

                        return (
                            item &&
                            typeof item.id === 'string' &&
                            typeof item.name === 'string' &&
                            typeof item.content === 'string'
                        );
                    })
                    : [];

        } catch (error) {

            prompts = [];
        }
    }

    function savePrompts() {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(prompts)
        );
    }

    function getPromptName() {

        const explicitName =
            promptNameInput.value.trim();

        if (explicitName) {
            return explicitName;
        }

        const firstLine =
            textarea.value
                .trim()
                .split(/\r?\n/)
                .find(Boolean);

        if (firstLine) {
            return firstLine.slice(0, 60);
        }

        return 'Untitled prompt';
    }

    function getVisiblePrompts() {

        const query =
            promptSearchInput.value
                .trim()
                .toLowerCase();

        const sorted =
            [...prompts].sort((a, b) => {

                return (
                    new Date(b.updatedAt || b.createdAt).getTime() -
                    new Date(a.updatedAt || a.createdAt).getTime()
                );
            });

        if (!query) {
            return sorted;
        }

        return sorted.filter((prompt) => {

            return (
                prompt.name.toLowerCase().includes(query) ||
                prompt.content.toLowerCase().includes(query)
            );
        });
    }

    function renderPromptList() {

        if (!promptList) {
            return;
        }

        promptList.textContent = '';

        const visiblePrompts =
            getVisiblePrompts();

        if (!visiblePrompts.length) {

            const empty =
                document.createElement('div');

            empty.className =
                'ai-prompt-empty';

            empty.textContent =
                promptSearchInput.value.trim()
                    ? 'No matching prompts'
                    : 'No saved prompts';

            promptList.appendChild(empty);

            return;
        }

        for (const prompt of visiblePrompts) {

            const item =
                document.createElement('div');

            item.className =
                'ai-prompt-item';

            if (
                prompt.id === activePromptId
            ) {
                item.classList.add('active');
            }

            const name =
                document.createElement('span');

            name.className =
                'ai-prompt-item-name';

            name.textContent =
                prompt.name;

            const meta =
                document.createElement('span');

            meta.className =
                'ai-prompt-item-meta';

            meta.textContent =
                formatDate(prompt.updatedAt || prompt.createdAt);

            const preview =
                document.createElement('span');

            preview.className =
                'ai-prompt-item-preview';

            preview.textContent =
                prompt.content.replace(/\s+/g, ' ').trim();

            const content =
                document.createElement('button');

            content.type =
                'button';

            content.className =
                'ai-prompt-item-content';

            content.title =
                'Append prompt';

            content.appendChild(name);
            content.appendChild(meta);
            content.appendChild(preview);

            const actions =
                document.createElement('div');

            actions.className =
                'ai-prompt-item-actions';

            const editButton =
                document.createElement('button');

            editButton.type =
                'button';

            editButton.className =
                'ai-prompt-item-action';

            editButton.textContent =
                'Edit';

            editButton.title =
                'Edit this prompt';

            const deleteButton =
                document.createElement('button');

            deleteButton.type =
                'button';

            deleteButton.className =
                'ai-prompt-item-action danger';

            deleteButton.textContent =
                'Del';

            deleteButton.title =
                'Delete this prompt';

            actions.appendChild(editButton);
            actions.appendChild(deleteButton);

            item.appendChild(content);
            item.appendChild(actions);

            content.addEventListener(
                'click',
                () => {

                    appendPromptToEditor(prompt.id);
                }
            );

            editButton.addEventListener(
                'click',
                () => {

                    editPrompt(prompt.id);
                }
            );

            deleteButton.addEventListener(
                'click',
                () => {

                    deletePrompt(prompt.id);
                }
            );

            promptList.appendChild(item);
        }
    }

    function appendPromptToEditor(id) {

        const prompt =
            prompts.find((item) => {

                return item.id === id;
            });

        if (!prompt) {
            return;
        }

        const currentValue =
            textarea.value;

        const separator =
            currentValue.trim()
                ? '\n\n'
                : '';

        textarea.value =
            currentValue + separator + prompt.content;

        activePromptId = null;

        textarea.selectionStart =
            textarea.value.length;

        textarea.selectionEnd =
            textarea.value.length;

        renderPromptList();
        syncToAIStudio();
        textarea.focus();
    }

    function editPrompt(id) {

        const prompt =
            prompts.find((item) => {

                return item.id === id;
            });

        if (!prompt) {
            return;
        }

        activePromptId =
            prompt.id;

        promptNameInput.value =
            prompt.name;

        textarea.value =
            prompt.content;

        renderPromptList();
        textarea.focus();
    }

    function clearEditor() {

        activePromptId = null;
        promptNameInput.value = '';
        textarea.value = '';

        renderPromptList();
        textarea.focus();
    }

    function createPrompt() {

        const content =
            textarea.value;

        if (!content.trim()) {
            textarea.focus();
            return;
        }

        const now =
            getTimestamp();

        const prompt =
            {
                id: createPromptId(),
                name: getPromptName(),
                content,
                createdAt: now,
                updatedAt: now
            };

        prompts.push(prompt);
        activePromptId = prompt.id;
        promptNameInput.value = prompt.name;

        savePrompts();
        renderPromptList();
    }

    function updatePrompt() {

        if (!activePromptId) {
            textarea.focus();
            return;
        }

        const prompt =
            prompts.find((item) => {

                return item.id === activePromptId;
            });

        if (!prompt) {
            activePromptId = null;
            textarea.focus();
            return;
        }

        prompt.name =
            getPromptName();

        prompt.content =
            textarea.value;

        prompt.updatedAt =
            getTimestamp();

        promptNameInput.value =
            prompt.name;

        savePrompts();
        renderPromptList();
    }

    function deletePrompt(id = activePromptId) {

        if (!id) {
            return;
        }

        const prompt =
            prompts.find((item) => {

                return item.id === id;
            });

        if (
            prompt &&
            !window.confirm('Delete this saved prompt?')
        ) {
            return;
        }

        prompts =
            prompts.filter((item) => {

                return item.id !== id;
            });

        savePrompts();

        if (activePromptId === id) {
            clearEditor();
            return;
        }

        renderPromptList();
    }

    function injectStyle() {

        if (
            document.getElementById(
                'ai-focus-style'
            )
        ) {
            return;
        }

        const style =
            document.createElement('style');

        style.id =
            'ai-focus-style';

        style.textContent = `

            /* backdrop-filter is extremely slow under software rendering */
            * {
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
            }

            .ai-truncate-button.armed {

                color: #ff6b6b;
                background: rgba(255,107,107,0.14);
            }

            .ai-truncate-button:disabled {

                opacity: 0.5;
                cursor: progress;
            }

            #ai-sync-panel {

                position: fixed;
                top: 120px;
                right: 24px;
                width: 420px;
                height: 520px;
                z-index: 999999999;
                display: flex;
                flex-direction: column;
                background: rgba(20,20,24,0.96);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0,0,0,0.45);
                transition:
                    width 0.2s ease,
                    height 0.2s ease,
                    transform 0.2s ease;
                font-family:
                    Inter,
                    "Microsoft YaHei",
                    sans-serif;
                contain: layout style paint;
                transform: translateZ(0);
            }

            #ai-sync-panel.focus-mode {

                border-radius: 24px;
                box-shadow: 0 30px 100px rgba(0,0,0,0.6);
            }

            #ai-sync-title {

                padding: 14px 18px;
                background:
                    linear-gradient(
                        135deg,
                        #4285f4,
                        #7b61ff
                    );
                color: white;
                font-size: 15px;
                font-weight: 700;
                user-select: none;
                cursor: move;
                flex: 0 0 auto;
            }

            #ai-sync-main {

                flex: 1 1 auto;
                min-height: 0;
                display: flex;
                flex-direction: column;
            }

            #ai-sync-editor {

                flex: 1 1 auto;
                min-height: 250px;
                display: flex;
                flex-direction: column;
                border-bottom: 1px solid rgba(255,255,255,0.06);
            }

            #ai-prompt-toolbar {

                flex: 0 0 auto;
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto auto auto;
                gap: 8px;
                padding: 10px 12px;
                border-bottom: 1px solid rgba(255,255,255,0.06);
            }

            #ai-prompt-name,
            #ai-prompt-search {

                min-width: 0;
                height: 32px;
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 8px;
                outline: none;
                background: rgba(255,255,255,0.07);
                color: white;
                padding: 0 10px;
                box-sizing: border-box;
                font-size: 12px;
            }

            #ai-prompt-name::placeholder,
            #ai-prompt-search::placeholder {

                color: rgba(255,255,255,0.4);
            }

            .ai-prompt-button {

                height: 32px;
                min-width: 44px;
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 8px;
                background: rgba(255,255,255,0.08);
                color: rgba(255,255,255,0.88);
                padding: 0 10px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
            }

            .ai-prompt-button:hover {

                background: rgba(255,255,255,0.14);
                color: white;
            }

            .ai-prompt-button.primary {

                background: #1a73e8;
                border-color: #1a73e8;
                color: white;
            }

            .ai-prompt-button.danger:hover {

                background: rgba(234,67,53,0.22);
                border-color: rgba(234,67,53,0.5);
            }

            #ai-sync-textarea {

                flex: 1 1 auto;
                width: 100%;
                min-height: 0;
                border: none;
                outline: none;
                resize: none;
                background: transparent;
                color: white;
                padding: 18px;
                box-sizing: border-box;
                font-size: 15px;
                line-height: 1.8;
                font-family:
                    Consolas,
                    Monaco,
                    monospace;
            }

            #ai-sync-textarea::placeholder {

                color: rgba(255,255,255,0.4);
            }

            #ai-prompt-library {

                flex: 0 0 185px;
                min-height: 0;
                display: flex;
                flex-direction: column;
            }

            #ai-prompt-library-head {

                flex: 0 0 auto;
                display: grid;
                grid-template-columns: minmax(0, 1fr);
                gap: 8px;
                padding: 10px 12px;
                border-bottom: 1px solid rgba(255,255,255,0.06);
            }

            #ai-prompt-list {

                flex: 1 1 auto;
                min-height: 0;
                overflow: auto;
                padding: 8px;
            }

            .ai-prompt-item {

                width: 100%;
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 8px;
                margin: 0 0 6px;
                padding: 8px;
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 8px;
                background: rgba(255,255,255,0.05);
                color: white;
                text-align: left;
            }

            .ai-prompt-item:hover,
            .ai-prompt-item.active {

                background: rgba(66,133,244,0.18);
                border-color: rgba(66,133,244,0.5);
            }

            .ai-prompt-item-content {

                min-width: 0;
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                grid-template-rows: auto auto;
                gap: 3px 8px;
                padding: 0;
                border: none;
                background: transparent;
                color: inherit;
                text-align: left;
                cursor: pointer;
            }

            .ai-prompt-item-name {

                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 13px;
                font-weight: 700;
            }

            .ai-prompt-item-meta {

                color: rgba(255,255,255,0.45);
                font-size: 11px;
                white-space: nowrap;
            }

            .ai-prompt-item-preview {

                grid-column: 1 / -1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: rgba(255,255,255,0.56);
                font-size: 12px;
            }

            .ai-prompt-item-actions {

                display: flex;
                align-items: center;
                gap: 6px;
            }

            .ai-prompt-item-action {

                height: 26px;
                min-width: 36px;
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 6px;
                background: rgba(255,255,255,0.08);
                color: rgba(255,255,255,0.78);
                padding: 0 7px;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
            }

            .ai-prompt-item-action:hover {

                background: rgba(255,255,255,0.14);
                color: white;
            }

            .ai-prompt-item-action.danger:hover {

                background: rgba(234,67,53,0.22);
                border-color: rgba(234,67,53,0.5);
            }

            .ai-prompt-empty {

                padding: 18px 10px;
                color: rgba(255,255,255,0.45);
                font-size: 12px;
                text-align: center;
            }

            #ai-sync-footer {

                flex: 0 0 40px;
                display: flex;
                align-items: center;
                padding: 0 16px;
                border-top: 1px solid rgba(255,255,255,0.06);
                color: rgba(255,255,255,0.5);
                font-size: 12px;
            }

            #ai-sync-panel.focus-mode #ai-sync-main {

                display: grid;
                grid-template-columns: minmax(0, 1fr) 320px;
                grid-template-rows: minmax(0, 1fr);
            }

            #ai-sync-panel.focus-mode #ai-sync-editor {

                min-height: 0;
                border-right: 1px solid rgba(255,255,255,0.06);
                border-bottom: none;
            }

            #ai-sync-panel.focus-mode #ai-prompt-library {

                flex-basis: auto;
            }

            @media (max-width: 720px) {

                #ai-sync-panel {

                    right: 12px;
                    width: calc(100vw - 24px);
                    height: 540px;
                }

                #ai-prompt-toolbar {

                    grid-template-columns: minmax(0, 1fr) auto auto;
                }

                #ai-prompt-toolbar .ai-prompt-button {

                    min-width: 54px;
                }

                #ai-sync-panel.focus-mode #ai-sync-main {

                    display: flex;
                    flex-direction: column;
                }
            }

        `;

        document.head.appendChild(style);
    }

    function findTargetTextarea() {

        if (
            cachedTarget &&
            document.contains(cachedTarget)
        ) {
            return cachedTarget;
        }

        const selectors = [

            'textarea',
            '[contenteditable="true"]',
            'ms-chat-input textarea'
        ];

        for (const selector of selectors) {

            const elements =
                document.querySelectorAll(selector);

            for (const el of elements) {

                if (
                    panel &&
                    panel.contains(el)
                ) {
                    continue;
                }

                const rect =
                    el.getBoundingClientRect();

                if (
                    rect.bottom >
                    window.innerHeight - 320
                ) {

                    cachedTarget = el;

                    return el;
                }
            }
        }

        return null;
    }

    function setNativeValue(
        element,
        value
    ) {

        const prototype =
            Object.getPrototypeOf(element);

        const descriptor =
            Object.getOwnPropertyDescriptor(
                prototype,
                'value'
            );

        const setter =
            descriptor?.set;

        if (setter) {

            setter.call(
                element,
                value
            );

        } else {

            element.value = value;
        }
    }

    function syncToAIStudio() {

        const target =
            findTargetTextarea();

        if (!target) {
            return;
        }

        const value =
            textarea.value;

        if (
            target.tagName.toLowerCase()
            === 'textarea'
        ) {

            setNativeValue(
                target,
                value
            );

            target.dispatchEvent(
                new Event(
                    'input',
                    {
                        bubbles: true
                    }
                )
            );

            return;
        }

        target.textContent =
            value;

        target.dispatchEvent(
            new InputEvent(
                'input',
                {
                    bubbles: true,
                    data: value,
                    inputType: 'insertText'
                }
            )
        );
    }

    function setAppVisible(visible) {

        const app =
            document.querySelector(
                'app-root'
            );

        if (!app) {
            return;
        }

        app.style.display =
            visible
                ? ''
                : 'none';
    }

    function enterFocusMode() {

        focused = true;

        panel.classList.add(
            'focus-mode'
        );

        panel.style.left = '50%';
        panel.style.top = '50%';
        panel.style.right = 'auto';
        panel.style.width = '78vw';
        panel.style.height = '76vh';
        panel.style.transform =
            'translate(-50%, -50%)';

        setAppVisible(false);
    }

    function exitFocusMode() {

        focused = false;

        panel.classList.remove(
            'focus-mode'
        );

        panel.style.transform = '';
        panel.style.width = '';
        panel.style.height = '';
        panel.style.top = '120px';
        panel.style.right = '24px';
        panel.style.left = '';

        setAppVisible(true);
        syncToAIStudio();
    }

    function createButton(
        label,
        className,
        handler
    ) {

        const button =
            document.createElement('button');

        button.type =
            'button';

        button.className =
            'ai-prompt-button ' + className;

        button.textContent =
            label;

        button.addEventListener(
            'click',
            handler
        );

        return button;
    }

    function createPanel() {

        if (
            document.getElementById(
                'ai-sync-panel'
            )
        ) {
            return;
        }

        loadPrompts();

        panel =
            document.createElement('div');

        panel.id =
            'ai-sync-panel';

        const title =
            document.createElement('div');

        title.id =
            'ai-sync-title';

        title.textContent =
            'Focus Prompt';

        const main =
            document.createElement('div');

        main.id =
            'ai-sync-main';

        const editor =
            document.createElement('section');

        editor.id =
            'ai-sync-editor';

        const toolbar =
            document.createElement('div');

        toolbar.id =
            'ai-prompt-toolbar';

        promptNameInput =
            document.createElement('input');

        promptNameInput.id =
            'ai-prompt-name';

        promptNameInput.type =
            'text';

        promptNameInput.placeholder =
            'Prompt name';

        toolbar.appendChild(promptNameInput);

        toolbar.appendChild(
            createButton(
                'New',
                '',
                clearEditor
            )
        );

        toolbar.appendChild(
            createButton(
                'Save',
                'primary',
                createPrompt
            )
        );

        toolbar.appendChild(
            createButton(
                'Update',
                '',
                updatePrompt
            )
        );

        textarea =
            document.createElement('textarea');

        textarea.id =
            'ai-sync-textarea';

        textarea.placeholder =
            'Write your prompt here...';

        editor.appendChild(toolbar);
        editor.appendChild(textarea);

        const library =
            document.createElement('section');

        library.id =
            'ai-prompt-library';

        const libraryHead =
            document.createElement('div');

        libraryHead.id =
            'ai-prompt-library-head';

        promptSearchInput =
            document.createElement('input');

        promptSearchInput.id =
            'ai-prompt-search';

        promptSearchInput.type =
            'search';

        promptSearchInput.placeholder =
            'Search saved prompts';

        libraryHead.appendChild(promptSearchInput);

        promptList =
            document.createElement('div');

        promptList.id =
            'ai-prompt-list';

        library.appendChild(libraryHead);
        library.appendChild(promptList);

        const footer =
            document.createElement('div');

        footer.id =
            'ai-sync-footer';

        footer.textContent =
            'Local prompt library';

        main.appendChild(editor);
        main.appendChild(library);

        panel.appendChild(title);
        panel.appendChild(main);
        panel.appendChild(footer);

        document.body.appendChild(panel);

        textarea.addEventListener(
            'focus',
            enterFocusMode
        );

        textarea.addEventListener(
            'keydown',
            (e) => {

                if (
                    e.key === 'Escape'
                ) {

                    exitFocusMode();
                    return;
                }

                if (
                    (e.ctrlKey || e.metaKey) &&
                    e.key.toLowerCase() === 's'
                ) {

                    e.preventDefault();
                    updatePrompt();
                }
            }
        );

        promptSearchInput.addEventListener(
            'input',
            renderPromptList
        );

        document.addEventListener(
            'mousedown',
            (e) => {

                if (!focused) {
                    return;
                }

                if (
                    panel.contains(e.target)
                ) {
                    return;
                }

                exitFocusMode();
            }
        );

        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        title.addEventListener(
            'mousedown',
            (e) => {

                if (focused) {
                    return;
                }

                dragging = true;

                const rect =
                    panel.getBoundingClientRect();

                offsetX =
                    e.clientX - rect.left;

                offsetY =
                    e.clientY - rect.top;

                document.body.style.userSelect =
                    'none';
            }
        );

        document.addEventListener(
            'mousemove',
            (e) => {

                if (!dragging) {
                    return;
                }

                panel.style.left =
                    (e.clientX - offsetX)
                    + 'px';

                panel.style.top =
                    (e.clientY - offsetY)
                    + 'px';

                panel.style.right =
                    'auto';
            }
        );

        document.addEventListener(
            'mouseup',
            () => {

                dragging = false;

                document.body.style.userSelect =
                    '';
            }
        );

        renderPromptList();
    }

    function sleep(ms) {

        return new Promise(
            (resolve) => setTimeout(resolve, ms)
        );
    }

    async function waitFor(
        check,
        timeout = 3000
    ) {

        const start =
            Date.now();

        while (
            Date.now() - start < timeout
        ) {

            const result =
                check();

            if (result) {
                return result;
            }

            await sleep(50);
        }

        return null;
    }

    function getChatTurns() {

        return [
            ...document.querySelectorAll(
                'ms-chat-turn'
            )
        ];
    }

    async function deleteChatTurn(turn) {

        const optionsButton =
            turn.querySelector(
                'button[aria-label="Open options"]'
            );

        if (!optionsButton) {
            return false;
        }

        optionsButton.click();

        const deleteItem =
            await waitFor(() =>
                [
                    ...document.querySelectorAll(
                        '.cdk-overlay-container [role="menuitem"]'
                    )
                ].find((item) =>
                    item.textContent.includes('Delete')
                )
            );

        if (!deleteItem) {

            document.body.dispatchEvent(
                new KeyboardEvent(
                    'keydown',
                    {
                        key: 'Escape',
                        bubbles: true
                    }
                )
            );

            return false;
        }

        deleteItem.click();

        return Boolean(
            await waitFor(() =>
                !document.contains(turn)
            )
        );
    }

    let truncating = false;

    // Delete from the last turn upward so remaining turns never shift.
    async function truncateFrom(turn, button) {

        if (truncating) {
            return;
        }

        truncating = true;
        button.disabled = true;

        try {

            let turns =
                getChatTurns();

            while (
                turns.includes(turn)
            ) {

                const last =
                    turns[turns.length - 1];

                if (
                    !(await deleteChatTurn(last))
                ) {

                    console.warn(
                        '[AI Focus] Failed to delete turn',
                        last.id
                    );

                    break;
                }

                turns =
                    getChatTurns();
            }

        } finally {

            truncating = false;
            button.disabled = false;
        }
    }

    function createTruncateButton(turn) {

        const button =
            document.createElement('button');

        button.type =
            'button';

        button.className =
            'ai-truncate-button ms-button-borderless ms-button-icon';

        button.title =
            'Delete this and all turns below';

        // Inline SVG: AI Studio's icon font is subset and lacks delete_sweep,
        // and Trusted Types blocks innerHTML, so build it node by node.
        const SVG_NS =
            'http://www.w3.org/2000/svg';

        const svg =
            document.createElementNS(SVG_NS, 'svg');

        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'currentColor');

        const path =
            document.createElementNS(SVG_NS, 'path');

        path.setAttribute(
            'd',
            'M15 16h4v2h-4zm0-8h7v2h-7zm0 4h6v2h-6zM3 18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8H3v10zM14 5h-3l-1-1H6L5 5H2v2h12z'
        );

        svg.appendChild(path);
        button.appendChild(svg);

        let disarmTimer = null;

        button.addEventListener(
            'click',
            (e) => {

                e.stopPropagation();

                if (
                    !button.classList.contains('armed')
                ) {

                    const turns =
                        getChatTurns();

                    const count =
                        turns.length -
                        turns.indexOf(turn);

                    button.classList.add('armed');

                    button.title =
                        `Click again to delete ${count} turn(s)`;

                    disarmTimer =
                        setTimeout(() => {

                            button.classList.remove('armed');

                            button.title =
                                'Delete this and all turns below';

                        }, 3000);

                    return;
                }

                clearTimeout(disarmTimer);
                button.classList.remove('armed');

                truncateFrom(
                    turn,
                    button
                );
            }
        );

        return button;
    }

    function decorateChatTurns() {

        for (const turn of getChatTurns()) {

            const options =
                turn.querySelector(
                    'ms-chat-turn-options'
                );

            if (
                !options ||
                options.parentElement.querySelector(
                    '.ai-truncate-button'
                )
            ) {
                continue;
            }

            options.parentElement.insertBefore(
                createTruncateButton(turn),
                options
            );
        }
    }

    let decorateScheduled = false;

    function scheduleDecorate() {

        if (decorateScheduled) {
            return;
        }

        decorateScheduled = true;

        requestAnimationFrame(() => {

            decorateScheduled = false;
            decorateChatTurns();
        });
    }

    injectStyle();
    createPanel();
    decorateChatTurns();

    const observer =
        new MutationObserver(() => {

            if (
                !document.getElementById(
                    'ai-sync-panel'
                )
            ) {

                createPanel();
            }

            if (
                cachedTarget &&
                !document.contains(
                    cachedTarget
                )
            ) {

                cachedTarget = null;
            }

            scheduleDecorate();
        });

    observer.observe(
        document.documentElement,
        {
            childList: true,
            subtree: true
        }
    );

})();
