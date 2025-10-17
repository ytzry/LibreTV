function artplayerPluginSkipSectionsUI(options = {}) {
  let {
    skipIntro = 0,
    skipOutro = 0,
    autoConfirm = true,
    storageKey = 'art-skip-pref',
  } = options;

  return (art) => {
    const { video, notice, controls, layers } = art;
    let userPref = loadUserPref();
    let outroPromptShown = false;
    let introSkipped = false;
    let panelVisible = false;
    let panelEl = null;

    /** =============== 控制栏按钮 =============== */
    const button = controls.add({
      name: 'skip-sections-ui',
      position: 'right',
      html: '⚙️ 跳过设置',
      tooltip: '设置片头片尾跳过',
      style: { cursor: 'pointer', fontSize: '13px', padding: '2px 8px' },
      click() {
        togglePanel();
      },
      contextmenu(e) {
        e.preventDefault();
        localStorage.removeItem(storageKey);
        userPref = null;
        notice.show('已重置片尾跳过偏好');
      },
    });

    /** =============== 跳过逻辑 =============== */
    function handleSkip() {
      if (skipIntro > 0 && video.currentTime < skipIntro) {
        video.currentTime = skipIntro;
        notice.show(`已跳过 ${skipIntro} 秒片头`);
        introSkipped = true;
        return;
      }

      if (skipOutro > 0 && video.duration - video.currentTime <= skipOutro) {
        video.currentTime = video.duration - 1;
        notice.show(`已跳过片尾`);
        outroPromptShown = true;
        return;
      }

      notice.show(`当前不在片头或片尾区域`);
    }

    art.on('ready', () => {
      if (skipIntro > 0 && video.currentTime < skipIntro) {
        setTimeout(() => {
          video.currentTime = skipIntro;
          notice.show(`自动跳过 ${skipIntro} 秒片头`);
          introSkipped = true;
        }, 500);
      }
    });

    art.on('timeupdate', () => {
      if (
        skipOutro > 0 &&
        video.duration - video.currentTime <= skipOutro &&
        !outroPromptShown
      ) {
        outroPromptShown = true;
        if (userPref === 'skip') {
          video.currentTime = video.duration - 1;
          notice.show('根据偏好自动跳过片尾');
        } else if (userPref === 'no-skip') {
          notice.show('根据偏好保留片尾播放');
        } else if (autoConfirm) {
          video.currentTime = video.duration - 1;
          notice.show(`自动跳过片尾 (${skipOutro}s)`);
        } else {
          showOutroPrompt();
        }
      }
    });

    /** =============== 片尾提示 =============== */
    function showOutroPrompt() {
      const layer = document.createElement('div');
      layer.style.cssText = `
        position:absolute;bottom:20%;left:50%;transform:translateX(-50%);
        background:rgba(0,0,0,0.6);color:#fff;padding:8px 12px;border-radius:8px;
        font-size:14px;display:flex;gap:8px;align-items:center;z-index:9999;
      `;
      layer.innerHTML = `
        <span>是否跳过片尾？</span>
        <button style="background:#2196f3;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">是</button>
        <button style="background:#666;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">否</button>
      `;
      const [yesBtn, noBtn] = layer.querySelectorAll('button');
      yesBtn.onclick = () => {
        saveUserPref('skip');
        video.currentTime = video.duration - 1;
        notice.show('已跳过片尾，并记住此选择');
        layer.remove();
      };
      noBtn.onclick = () => {
        saveUserPref('no-skip');
        notice.show('保留片尾播放，并记住此选择');
        layer.remove();
      };
      layers.append(layer);
    }

    /** =============== 设置面板 =============== */
    function togglePanel() {
      if (panelVisible) {
        panelEl?.remove();
        panelVisible = false;
        return;
      }
      panelEl = document.createElement('div');
      panelEl.style.cssText = `
        position:absolute;bottom:50px;right:20px;background:rgba(0,0,0,0.75);
        color:#fff;padding:12px 16px;border-radius:10px;width:220px;z-index:9999;
        display:flex;flex-direction:column;gap:8px;font-size:13px;
      `;
      panelEl.innerHTML = `
        <label>片头跳过秒数：
          <input type="number" min="0" step="1" value="${skipIntro}" style="width:60px;text-align:center;border-radius:4px;border:none;padding:2px;">
        </label>
        <label>片尾跳过秒数：
          <input type="number" min="0" step="1" value="${skipOutro}" style="width:60px;text-align:center;border-radius:4px;border:none;padding:2px;">
        </label>
        <div style="display:flex;justify-content:space-between;gap:8px;margin-top:8px;">
          <button id="saveSkip" style="flex:1;background:#2196f3;color:#fff;border:none;border-radius:4px;padding:4px;cursor:pointer;">保存</button>
          <button id="closeSkip" style="flex:1;background:#555;color:#fff;border:none;border-radius:4px;padding:4px;cursor:pointer;">关闭</button>
        </div>
      `;
      layers.append(panelEl);
      panelVisible = true;

      const [introInput, outroInput] = panelEl.querySelectorAll('input');
      const saveBtn = panelEl.querySelector('#saveSkip');
      const closeBtn = panelEl.querySelector('#closeSkip');

      saveBtn.onclick = () => {
        skipIntro = Number(introInput.value);
        skipOutro = Number(outroInput.value);
        notice.show(`跳过设置已更新：片头 ${skipIntro}s，片尾 ${skipOutro}s`);
        togglePanel();
      };

      closeBtn.onclick = togglePanel;
    }

    /** =============== 本地存储 =============== */
    function loadUserPref() {
      try {
        return localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    }

    function saveUserPref(pref) {
      try {
        localStorage.setItem(storageKey, pref);
        userPref = pref;
      } catch {}
    }

    /** =============== 返回插件实例 =============== */
    return {
      name: 'skip-sections-ui',
      setSkip(intro, outro) {
        skipIntro = intro;
        skipOutro = outro;
        notice.show(`更新跳过设置：片头 ${intro}s，片尾 ${outro}s`);
      },
      destroy() {
        controls.remove('skip-sections-ui');
        panelEl?.remove();
      },
    };
  };
}
