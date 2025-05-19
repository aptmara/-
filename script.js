// === script.js (v20240519 - Improved for Robustness) ===

// --- グローバル設定 ---
const AppConfig = {
    themeKey: 'scenarioViewerTheme_v4',
    fontSizeKey: 'scenarioViewerFontSize_v4',
    tocStateKeyPrefix: 'scenarioViewerTOCCollapseState_v4_',
    filterStateKeyPrefix: 'scenarioViewerFilterState_v4_',
    collapsibleStateKeyPrefix: 'scenarioViewerCollapsibleState_v4_',
    memoStateKeyPrefix: 'scenarioViewerMemoState_v4_',
    flagStateKeyPrefix: 'scenarioViewerFlagState_v4_',
    defaultTheme: 'dark',
    defaultFontSize: 16, // px
    minFontSize: 12,
    maxFontSize: 22,
    scrollOffset: 60, // 目次からのジャンプ時のオフセット (固定ヘッダーの高さを考慮)
    debounceDelay: 300, // ms
};

// --- DOM Ready ---
document.addEventListener('DOMContentLoaded', () => {
    initGlobalUIControls();
    initToTopButton();
    initCommonCollapsibles('common-page-key'); // ページキーは汎用的に

    if (typeof pageSpecificInit === 'function') {
        pageSpecificInit();
    } else {
        // console.warn("pageSpecificInit function is not defined on this page.");
    }
});

// --- ユーティリティ関数 ---
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function getElementId(element, prefix, index, pageKey) {
    return element.id || `${prefix}-${pageKey}-${index}`;
}

// --- UIコントロール初期化 (テーマ、フォントサイズ) ---
function initGlobalUIControls() {
    const uiControlsTop = document.getElementById('ui-controls-top');
    if (!uiControlsTop) return;

    // Theme Switcher
    try {
        const themeButtons = uiControlsTop.querySelectorAll('#theme-switcher button[data-theme]');
        if (themeButtons.length > 0) {
            let currentTheme = localStorage.getItem(AppConfig.themeKey) || AppConfig.defaultTheme;
            document.body.classList.toggle('light-theme', currentTheme === 'light');
            themeButtons.forEach(button => {
                button.classList.toggle('active', button.dataset.theme === currentTheme);
                button.addEventListener('click', function() {
                    currentTheme = this.dataset.theme;
                    document.body.classList.toggle('light-theme', currentTheme === 'light');
                    localStorage.setItem(AppConfig.themeKey, currentTheme);
                    themeButtons.forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');
                });
            });
        }
    } catch (e) { console.error("Theme switcher init error:", e); }

    // Fontsize Adjuster
    try {
        const decreaseButton = uiControlsTop.querySelector('#fontsize-adjuster [data-action="decrease-font"]');
        const resetButton = uiControlsTop.querySelector('#fontsize-adjuster [data-action="reset-font"]');
        const increaseButton = uiControlsTop.querySelector('#fontsize-adjuster [data-action="increase-font"]');
        if (decreaseButton && resetButton && increaseButton) {
            let currentFontSize = parseFloat(localStorage.getItem(AppConfig.fontSizeKey)) || AppConfig.defaultFontSize;
            const updateFontSizeDOM = () => {
                document.documentElement.style.fontSize = currentFontSize + 'px';
                localStorage.setItem(AppConfig.fontSizeKey, currentFontSize.toString());
            };
            decreaseButton.addEventListener('click', () => {
                if (currentFontSize > AppConfig.minFontSize) { currentFontSize -= 1; updateFontSizeDOM(); }
            });
            resetButton.addEventListener('click', () => {
                currentFontSize = AppConfig.defaultFontSize; updateFontSizeDOM();
            });
            increaseButton.addEventListener('click', () => {
                if (currentFontSize < AppConfig.maxFontSize) { currentFontSize += 1; updateFontSizeDOM(); }
            });
            updateFontSizeDOM();
        }
    } catch (e) { console.error("Fontsize adjuster init error:", e); }
}

// --- トップへ戻るボタン ---
function initToTopButton() {
    const toTopButton = document.getElementById('to-top-button');
    const scrollContainer = document.querySelector('main#content-area') || document.querySelector('main') || window;

    if (toTopButton && scrollContainer) {
        const scrollElement = (scrollContainer === window || scrollContainer === document.body || scrollContainer === document.documentElement)
                            ? document.documentElement // window/body/docElement の場合は scrollTop を見る
                            : scrollContainer;

        const handleScroll = () => {
            toTopButton.classList.toggle('show', scrollElement.scrollTop > 300);
        };

        // `scrollContainer`が`window`でない場合、`scrollElement`は`scrollContainer`自身になる
        // `window`の場合は、イベントリスナーは`window`に、`scrollTop`は`document.documentElement`でチェック
        const eventTarget = (scrollContainer === window || scrollContainer === document.body || scrollContainer === document.documentElement) ? window : scrollContainer;
        eventTarget.addEventListener('scroll', handleScroll);
        handleScroll(); // 初期表示時のチェック

        toTopButton.addEventListener('click', (e) => {
            e.preventDefault();
            scrollElement.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}


// --- 汎用折りたたみ機能 (主に dt/dd) ---
function initCommonCollapsibles(pageKey) {
    const dtHeaders = document.querySelectorAll('dt.collapsible-header-item');
    dtHeaders.forEach((header, index) => {
        const content = header.nextElementSibling;
        const elementId = getElementId(header, 'collapsible-dt', index, pageKey);
        header.id = elementId; // Ensure ID for storage key
        const storageKey = `${AppConfig.collapsibleStateKeyPrefix}${elementId}`;

        if (content && content.classList.contains('collapsible-content-item')) {
            let isInitiallyCollapsed = true; // Default to collapsed
            try {
                const storedState = localStorage.getItem(storageKey);
                if (storedState !== null) {
                    isInitiallyCollapsed = (storedState === 'true');
                }
            } catch (e) { console.error("Error reading collapsible state from localStorage:", e); }

            header.classList.toggle('collapsed', isInitiallyCollapsed);
            content.classList.toggle('collapsed', isInitiallyCollapsed);

            header.addEventListener('click', function() {
                const isNowCollapsed = this.classList.toggle('collapsed');
                content.classList.toggle('collapsed', isNowCollapsed);
                try {
                    localStorage.setItem(storageKey, isNowCollapsed.toString());
                } catch (e) { console.error("Error writing collapsible state to localStorage:", e); }
            });
        }
    });
}

// --- 目次制御 ---
function initTableOfContents(tocNavSelector, mainContentSelector, pageKey) {
    const tocNav = document.querySelector(tocNavSelector);
    const mainContentElement = document.querySelector(mainContentSelector);

    if (!tocNav || !mainContentElement) return;

    const tocDetailsElements = tocNav.querySelectorAll('details');
    const tocLinks = Array.from(tocNav.querySelectorAll('ul li a[href^="#"], details > summary > a[href^="#"]'));
    const mainSections = Array.from(mainContentElement.querySelectorAll('section[id], h2[id], h3[id], h4[id], article[id]')).filter(el => el.id);
    const currentTocStateKey = `${AppConfig.tocStateKeyPrefix}${pageKey}`;

    const getDetailId = (detail, index) => detail.id || (detail.querySelector('summary > a') ? detail.querySelector('summary > a').getAttribute('href') : `toc-detail-${pageKey}-${index}`);

    function saveTocDetailsState() {
        const state = {};
        tocDetailsElements.forEach((detail, index) => state[getDetailId(detail, index)] = detail.open);
        try { localStorage.setItem(currentTocStateKey, JSON.stringify(state)); } catch (e) { console.error("Error saving TOC state:", e); }
    }

    function loadTocDetailsState() {
        try {
            const stateString = localStorage.getItem(currentTocStateKey);
            if (stateString) {
                const state = JSON.parse(stateString);
                tocDetailsElements.forEach((detail, index) => {
                    const detailId = getDetailId(detail, index);
                    if (state.hasOwnProperty(detailId)) detail.open = state[detailId];
                });
            } else {
                // Default open for specific sections if needed
                const introLink = tocNav.querySelector('summary a[href="#introduction-phase-main"]');
                if (introLink) introLink.closest('details')?.setAttribute('open', '');
            }
        } catch (e) { console.error("Error loading TOC state:", e); }
    }

    function openParentDetails(element) {
        let parent = element.parentElement;
        let stateChanged = false;
        while (parent) {
            if (parent.tagName === 'DETAILS' && !parent.open) {
                parent.open = true;
                stateChanged = true;
            }
            parent = parent.parentElement;
        }
        if (stateChanged) saveTocDetailsState(); // 親が開かれたら状態を保存
    }

    tocLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            const targetId = this.getAttribute('href');
            if (targetId && targetId.startsWith('#')) {
                const targetElement = document.getElementById(targetId.substring(1));
                if (targetElement) {
                    event.preventDefault();
                    openParentDetails(this);
                    mainContentElement.scrollTo({
                        top: targetElement.offsetTop - mainContentElement.offsetTop - AppConfig.scrollOffset,
                        behavior: 'smooth'
                    });
                    if (history.pushState) history.pushState(null, null, targetId);
                    else window.location.hash = targetId;
                }
            }
        });
    });

    let currentActiveTocItem = null;
    const observerOptions = {
        root: mainContentElement,
        rootMargin: `-${AppConfig.scrollOffset - 1}px 0px -${mainContentElement.clientHeight - AppConfig.scrollOffset - 150}px 0px`, // 上部150px範囲
        threshold: 0.01 // 少しでも見えたら
    };

    const observer = new IntersectionObserver(entries => {
        const intersectingEntries = entries.filter(entry => entry.isIntersecting);
        if (intersectingEntries.length === 0 && currentActiveTocItem) { // 画面内に該当セクションがない場合はアクティブ解除しない
            return;
        }

        intersectingEntries.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top); // 画面上部優先

        if (intersectingEntries.length > 0) {
            const targetId = intersectingEntries[0].target.getAttribute('id');
            const activeLink = tocNav.querySelector(`a[href="#${targetId}"]`);
            if (activeLink) {
                let listItem = activeLink.closest('li');
                if (!listItem && activeLink.parentElement?.tagName === 'SUMMARY') {
                    listItem = activeLink.parentElement.closest('li');
                }
                if (currentActiveTocItem) currentActiveTocItem.classList.remove('current-toc-item');
                if (listItem) {
                    listItem.classList.add('current-toc-item');
                    currentActiveTocItem = listItem;
                    openParentDetails(activeLink); // アクティブになったら親も開く
                }
            }
        }
    }, observerOptions);

    if (mainSections.length > 0) {
        mainSections.forEach(section => observer.observe(section));
    }


    // Initial highlight & scroll based on hash
    if (window.location.hash && mainSections.length > 0) {
        const initialTargetId = window.location.hash.substring(1);
        const initialTargetElement = document.getElementById(initialTargetId);
        if (initialTargetElement) {
            const initialTocLink = tocNav.querySelector(`a[href="#${initialTargetId}"]`);
            if (initialTocLink) {
                openParentDetails(initialTocLink);
                // IntersectionObserver が発火する前にスクロール位置を調整
                 mainContentElement.scrollTop = initialTargetElement.offsetTop - mainContentElement.offsetTop - AppConfig.scrollOffset;
                // 強制的にアクティブ化 (Observerが間に合わない場合のため)
                setTimeout(() => {
                    let listItem = initialTocLink.closest('li');
                    if (!listItem && initialTocLink.parentElement?.tagName === 'SUMMARY') listItem = initialTocLink.parentElement.closest('li');
                    if (currentActiveTocItem) currentActiveTocItem.classList.remove('current-toc-item');
                    if (listItem) {
                        listItem.classList.add('current-toc-item');
                        currentActiveTocItem = listItem;
                    }
                }, 150);
            }
        }
    }


    const tocExpandAllButton = tocNav.querySelector('#toc-expand-all');
    const tocCollapseAllButton = tocNav.querySelector('#toc-collapse-all');
    if (tocExpandAllButton) tocExpandAllButton.addEventListener('click', () => {
        tocDetailsElements.forEach(detail => detail.open = true); saveTocDetailsState();
    });
    if (tocCollapseAllButton) tocCollapseAllButton.addEventListener('click', () => {
        tocDetailsElements.forEach(detail => detail.open = false); saveTocDetailsState();
    });

    tocDetailsElements.forEach(detail => detail.addEventListener('toggle', saveTocDetailsState));
    loadTocDetailsState();
}


// --- 情報ブロックフィルタリング ---
function initContentFiltering(controlsWrapperSelector, mainContentSelector, pageKey) {
    const filterControlsWrapper = document.querySelector(controlsWrapperSelector);
    const mainContentElement = document.querySelector(mainContentSelector);

    if (!filterControlsWrapper || !mainContentElement) return;

    const checkboxes = Array.from(filterControlsWrapper.querySelectorAll('#filter-controls input[type="checkbox"][data-filter-class]'));
    const toggleAllButton = filterControlsWrapper.querySelector('#filter-toggle-all');
    const currentFilterStateKey = `${AppConfig.filterStateKeyPrefix}${pageKey}`;
    const filterableElementClasses = [
        'kp-directive', 'plot-point', 'branch-point', 'flag-info', 'skill-check-info',
        'dialogue-block', 'action-options', 'scene-description', 'npc-reaction',
        'important-note', 'bgm-suggestion', 'kp-note'
    ];
    const filterableElementsSelector = filterableElementClasses.map(cls => `.${cls}`).join(', ');

    function applyFilters() {
        const activeFilters = checkboxes.filter(cb => cb.checked).map(cb => cb.dataset.filterClass);
        const filterableElements = mainContentElement.querySelectorAll(filterableElementsSelector);

        filterableElements.forEach(el => {
            let shouldBeVisible = true; // デフォルトは表示
            if (checkboxes.length > 0) { // チェックボックスが存在する場合のみフィルタリングロジック適用
                 shouldBeVisible = activeFilters.length === 0 ? false : activeFilters.some(filterClass => el.classList.contains(filterClass));
            }
            el.classList.toggle('hidden-by-filter', !shouldBeVisible);
        });
    }

    function saveFilterState() {
        const state = {};
        checkboxes.forEach(cb => state[cb.dataset.filterClass] = cb.checked);
        try { localStorage.setItem(currentFilterStateKey, JSON.stringify(state)); } catch (e) { console.error("Error saving filter state:", e); }
    }

    function loadFilterState() {
        try {
            const stateString = localStorage.getItem(currentFilterStateKey);
            if (stateString) {
                const state = JSON.parse(stateString);
                checkboxes.forEach(cb => {
                    if (state.hasOwnProperty(cb.dataset.filterClass)) cb.checked = state[cb.dataset.filterClass];
                });
            } else { // 初回ロード時、全てチェック状態にする
                 checkboxes.forEach(cb => cb.checked = true);
            }
        } catch (e) { console.error("Error loading filter state:", e); }
    }

    if (checkboxes.length > 0) {
        checkboxes.forEach(checkbox => checkbox.addEventListener('change', () => { applyFilters(); saveFilterState(); }));
        if (toggleAllButton) {
            toggleAllButton.addEventListener('click', () => {
                const allCurrentlyChecked = checkboxes.every(cb => cb.checked);
                checkboxes.forEach(cb => cb.checked = !allCurrentlyChecked);
                applyFilters();
                saveFilterState();
            });
        }
        loadFilterState();
        applyFilters();
    }
}

// --- グローバル検索機能 (Mark.js が必要) ---
function initGlobalSearch(searchInputSelector, contentAreaSelector, resultSummarySelector, pageKey) {
    const searchInput = document.querySelector(searchInputSelector);
    const contentArea = document.querySelector(contentAreaSelector);
    const resultSummary = document.querySelector(resultSummarySelector);
    let markInstance;

    if (!searchInput || !contentArea) return;

    if (typeof Mark !== 'undefined') {
        markInstance = new Mark(contentArea);
    } else {
        console.warn("Mark.js library is not loaded. Search highlighting will not be available.");
        if(resultSummary) resultSummary.textContent = '検索ハイライト機能 (Mark.js) 未ロード';
        return;
    }

    searchInput.addEventListener('input', debounce(() => {
        const searchTerm = searchInput.value.trim();
        markInstance.unmark({
            done: () => {
                if (searchTerm.length < 2) {
                    if (resultSummary) resultSummary.textContent = '';
                    return;
                }
                markInstance.mark(searchTerm, {
                    separateWordSearch: false,
                    className: 'search-highlight',
                    done: (counter) => {
                        if (resultSummary) resultSummary.textContent = `${counter} 件ヒットしました。`;
                        if (counter > 0) {
                            const firstMark = contentArea.querySelector('.search-highlight');
                            if (firstMark) {
                                const scrollableParent = contentArea.closest('main') || contentArea;
                                scrollableParent.scrollTo({
                                    top: firstMark.offsetTop - scrollableParent.offsetTop - AppConfig.scrollOffset,
                                    behavior: 'smooth'
                                });
                            }
                        }
                    }
                });
            }
        });
    }, AppConfig.debounceDelay));
}

// --- KP専用メモ機能 ---
function initKPMemo(memoContainerSelector, pageKey) {
    const contentArea = document.querySelector(memoContainerSelector);
    if (!contentArea) return;

    const memoTargets = contentArea.querySelectorAll('.kp-directive, .plot-point, .important-note, section[id], article[id], h2[id], h3[id]'); // メモ対象を増やす

    memoTargets.forEach((el, index) => {
        const baseId = el.id || getElementId(el, 'memo-target', index, pageKey);
        const memoId = `memo-content-${baseId}`;
        const toggleId = `memo-toggle-${baseId}`;
        const storageKey = `${AppConfig.memoStateKeyPrefix}${baseId}`;

        const memoWrapper = document.createElement('div');
        memoWrapper.className = 'kp-memo-wrapper';

        const memoIcon = document.createElement('button');
        memoIcon.className = 'kp-memo-toggle-button';
        memoIcon.innerHTML = '<i class="fas fa-pencil-alt"></i> メモ';
        memoIcon.setAttribute('aria-expanded', 'false');
        memoIcon.id = toggleId;
        memoIcon.setAttribute('aria-controls', memoId);


        const memoTextarea = document.createElement('textarea');
        memoTextarea.id = memoId;
        memoTextarea.className = 'kp-private-memo';
        memoTextarea.placeholder = 'KP用プライベートメモ... (自動保存)';
        memoTextarea.style.display = 'none';
        memoTextarea.setAttribute('rows', '3');


        try {
            const savedMemo = localStorage.getItem(storageKey);
            if (savedMemo) memoTextarea.value = savedMemo;
        } catch (e) { console.error("Error loading memo:", e); }

        memoIcon.addEventListener('click', () => {
            const isHidden = memoTextarea.style.display === 'none';
            memoTextarea.style.display = isHidden ? 'block' : 'none';
            memoIcon.setAttribute('aria-expanded', isHidden.toString());
            if (isHidden) memoTextarea.focus();
        });

        memoTextarea.addEventListener('input', debounce(() => {
            try { localStorage.setItem(storageKey, memoTextarea.value); } catch (e) { console.error("Error saving memo:", e); }
        }, 500));

        memoWrapper.appendChild(memoIcon);
        memoWrapper.appendChild(memoTextarea);
        el.appendChild(memoWrapper); // 要素の最後にメモ欄を追加
    });
}

// --- フラグトラッカー機能 ---
function initFlagTracker(panelSelector, pageKey) {
    const panel = document.querySelector(panelSelector);
    if (!panel) return;

    const checkboxes = Array.from(panel.querySelectorAll('input[type="checkbox"][data-flag]'));
    if (checkboxes.length === 0) return;

    const storageKey = `${AppConfig.flagStateKeyPrefix}${pageKey}`;

    function saveFlags() {
        const flagsState = {};
        checkboxes.forEach(cb => flagsState[cb.dataset.flag] = cb.checked);
        try { localStorage.setItem(storageKey, JSON.stringify(flagsState)); } catch (e) { console.error("Error saving flags:", e); }
    }

    function loadFlags() {
        try {
            const storedFlags = localStorage.getItem(storageKey);
            if (storedFlags) {
                const flagsState = JSON.parse(storedFlags);
                checkboxes.forEach(cb => {
                    if (flagsState.hasOwnProperty(cb.dataset.flag)) cb.checked = flagsState[cb.dataset.flag];
                });
            }
        } catch (e) { console.error("Error loading flags:", e); }
    }

    checkboxes.forEach(cb => cb.addEventListener('change', saveFlags));
    loadFlags();
}

// --- タブ切り替えコンテンツ ---
function initTabbedContent(containerSelector = '.tab-container') {
    document.querySelectorAll(containerSelector).forEach(container => {
        const buttons = Array.from(container.querySelectorAll('.tab-button[data-tab]'));
        const panels = Array.from(container.querySelectorAll('.tab-panel[data-tab-panel]'));

        if (buttons.length === 0 || panels.length === 0) return;

        buttons.forEach(button => {
            button.addEventListener('click', () => {
                buttons.forEach(btn => btn.classList.remove('active'));
                panels.forEach(panel => panel.classList.remove('active'));

                button.classList.add('active');
                const targetTabKey = button.dataset.tab;
                const targetPanel = panels.find(p => p.dataset.tabPanel === targetTabKey);
                if (targetPanel) targetPanel.classList.add('active');
            });
        });
        // 初期状態で最初のタブ（またはdata-active属性を持つタブ）をアクティブにする
        const initialActiveButton = buttons.find(b => b.classList.contains('active')) || buttons[0];
        if (initialActiveButton) initialActiveButton.click();
    });
}