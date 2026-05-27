// ==UserScript==
// @name         AI Studio Focus Mode
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  极致流畅 AI Studio 输入模式
// @match        https://aistudio.google.com/*
// @grant        none
// ==/UserScript==

(function () {

    'use strict';

    ////////////////////////////////////////////////////////////
    // 全局状态
    ////////////////////////////////////////////////////////////

    let panel = null;
    let textarea = null;

    let cachedTarget = null;

    let focused = false;

    ////////////////////////////////////////////////////////////
    // 样式
    ////////////////////////////////////////////////////////////

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

            #ai-sync-panel {

                position: fixed;

                top: 120px;
                right: 24px;

                width: 360px;
                height: 280px;

                z-index: 999999999;

                background:
                    rgba(20,20,24,0.96);

                border:
                    1px solid rgba(255,255,255,0.08);

                border-radius: 20px;

                overflow: hidden;

                box-shadow:
                    0 20px 60px rgba(0,0,0,0.45);

                backdrop-filter:
                    blur(10px);

                transition:
                    width 0.2s ease,
                    height 0.2s ease,
                    transform 0.2s ease;

                font-family:
                    Inter,
                    "Microsoft YaHei",
                    sans-serif;

                contain:
                    layout style paint;

                transform:
                    translateZ(0);
            }

            ////////////////////////////////////////////////////
            // focus mode
            ////////////////////////////////////////////////////

            #ai-sync-panel.focus-mode {

                border-radius: 24px;

                box-shadow:
                    0 30px 100px rgba(0,0,0,0.6);
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
            }

            #ai-sync-textarea {

                width: 100%;
                height: calc(100% - 90px);

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

                color:
                    rgba(255,255,255,0.4);
            }

            #ai-sync-footer {

                height: 40px;

                display: flex;
                align-items: center;

                padding-left: 16px;

                border-top:
                    1px solid rgba(255,255,255,0.06);

                color:
                    rgba(255,255,255,0.5);

                font-size: 12px;
            }

        `;

        document.head.appendChild(style);
    }

    ////////////////////////////////////////////////////////////
    // 查找目标输入框
    ////////////////////////////////////////////////////////////

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
                    el.id === 'ai-sync-textarea'
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

    ////////////////////////////////////////////////////////////
    // React兼容
    ////////////////////////////////////////////////////////////

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

    ////////////////////////////////////////////////////////////
    // 同步
    ////////////////////////////////////////////////////////////

    function syncToAIStudio() {

        const target =
              findTargetTextarea();

        if (!target) {
            return;
        }

        const value =
              textarea.value;

        ////////////////////////////////////////////////////////
        // textarea
        ////////////////////////////////////////////////////////

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

        ////////////////////////////////////////////////////////
        // contenteditable
        ////////////////////////////////////////////////////////

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

    ////////////////////////////////////////////////////////////
    // 隐藏/恢复 app-root
    ////////////////////////////////////////////////////////////

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

    ////////////////////////////////////////////////////////////
    // focus mode
    ////////////////////////////////////////////////////////////

    function enterFocusMode() {

        focused = true;

        panel.classList.add(
            'focus-mode'
        );

        ////////////////////////////////////////////////////////
        // 直接修改 style
        ////////////////////////////////////////////////////////

        panel.style.left = '50%';

        panel.style.top = '50%';

        panel.style.right = 'auto';

        panel.style.width = '70vw';

        panel.style.height = '70vh';

        panel.style.transform =
            'translate(-50%, -50%)';

        ////////////////////////////////////////////////////////
        // 隐藏 AI Studio
        ////////////////////////////////////////////////////////

        setAppVisible(false);
    }

    ////////////////////////////////////////////////////////////
    // exit focus mode
    ////////////////////////////////////////////////////////////

    function exitFocusMode() {

        focused = false;

        panel.classList.remove(
            'focus-mode'
        );

        ////////////////////////////////////////////////////////
        // 恢复 style
        ////////////////////////////////////////////////////////

        panel.style.transform = '';

        panel.style.width = '';

        panel.style.height = '';

        panel.style.top = '120px';

        panel.style.right = '24px';

        panel.style.left = '';

        ////////////////////////////////////////////////////////
        // 恢复 AI Studio
        ////////////////////////////////////////////////////////

        setAppVisible(true);

        ////////////////////////////////////////////////////////
        // 同步内容
        ////////////////////////////////////////////////////////

        syncToAIStudio();
    }

    ////////////////////////////////////////////////////////////
    // 创建UI
    ////////////////////////////////////////////////////////////

    function createPanel() {

        if (
            document.getElementById(
                'ai-sync-panel'
            )
        ) {
            return;
        }

        panel =
            document.createElement('div');

        panel.id =
            'ai-sync-panel';

        ////////////////////////////////////////////////////////
        // title
        ////////////////////////////////////////////////////////

        const title =
              document.createElement('div');

        title.id =
            'ai-sync-title';

        title.textContent =
            'Focus Prompt';

        ////////////////////////////////////////////////////////
        // textarea
        ////////////////////////////////////////////////////////

        textarea =
            document.createElement('textarea');

        textarea.id =
            'ai-sync-textarea';

        textarea.placeholder =
            '在这里输入 Prompt...';

        ////////////////////////////////////////////////////////
        // footer
        ////////////////////////////////////////////////////////

        const footer =
              document.createElement('div');

        footer.id =
            'ai-sync-footer';

        footer.textContent =
            'Google AI Studio';

        ////////////////////////////////////////////////////////
        // append
        ////////////////////////////////////////////////////////

        panel.appendChild(title);

        panel.appendChild(textarea);

        panel.appendChild(footer);

        document.body.appendChild(panel);

        ////////////////////////////////////////////////////////
        // focus
        ////////////////////////////////////////////////////////

        textarea.addEventListener(
            'focus',
            enterFocusMode
        );

        ////////////////////////////////////////////////////////
        // blur
        ////////////////////////////////////////////////////////

        // textarea.addEventListener(
        //     'blur',
        //     exitFocusMode
        // );
        document.addEventListener(
            'mousedown',
            (e) => {

                ////////////////////////////////////////////////////////
                // 非 focus mode
                ////////////////////////////////////////////////////////

                if (!focused) {
                    return;
                }

                ////////////////////////////////////////////////////////
                // 点击 panel 内部
                ////////////////////////////////////////////////////////

                if (
                    panel.contains(e.target)
                ) {
                    return;
                }

                ////////////////////////////////////////////////////////
                // 点击外部
                ////////////////////////////////////////////////////////

                exitFocusMode();
            }
        );


        ////////////////////////////////////////////////////////
        // ESC退出 focus mode
        ////////////////////////////////////////////////////////

        textarea.addEventListener(
            'keydown',
            (e) => {

                if (
                    e.key === 'Escape'
                ) {

                    exitFocusMode();
                }
            }
        );

        ////////////////////////////////////////////////////////
        // 拖拽
        ////////////////////////////////////////////////////////

        let dragging = false;

        let offsetX = 0;
        let offsetY = 0;

        title.addEventListener(
            'mousedown',
            (e) => {

                //////////////////////////////////////////////////
                // focus mode 禁止拖拽
                //////////////////////////////////////////////////

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
    }

    ////////////////////////////////////////////////////////////
    // 初始化
    ////////////////////////////////////////////////////////////

    injectStyle();

    createPanel();

    ////////////////////////////////////////////////////////////
    // SPA兼容
    ////////////////////////////////////////////////////////////

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
          });

    observer.observe(
        document.documentElement,
        {
            childList: true,
            subtree: true
        }
    );

})();