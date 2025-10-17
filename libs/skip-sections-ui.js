function skipSectionsPlugin(option = {}) {
  let {
    skipIntro = 0,
    skipOutro = 0,
    autoConfirm = true,
    storageKey = "art-skip-pref",
  } = option;

  return (art) => {
    const { video, notice, layers, controls } = art;
    let userPref = loadUserPref();
    let outroPromptShown = false;

    // 从localStorage加载设置
    loadSkipSettings();

    function loadSkipSettings() {
      try {
        const savedSettings = localStorage.getItem(storageKey + "-settings");
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          skipIntro = settings.skipIntro || 0;
          skipOutro = settings.skipOutro || 0;
        }
      } catch (e) {
        console.warn("无法加载跳过设置:", e);
      }
    }

    function saveSkipSettings() {
      try {
        const settings = { skipIntro, skipOutro };
        localStorage.setItem(
          storageKey + "-settings",
          JSON.stringify(settings)
        );
      } catch (e) {
        console.warn("无法保存跳过设置:", e);
      }
    }

    // ======== 设置面板层 ========
    layers.add({
      name: "skipPanel",
      html: `
                <div style="
                    background: rgba(0,0,0,0.75);
                    color: #fff;
                    padding: 12px 16px;
                    border-radius: 10px;
                    width: 220px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    font-size: 13px;
                ">
                    <label>片头跳过秒数：
                        <input id="introInput" type="number" min="0" step="1" value="${skipIntro}" style="width:60px;text-align:center;border-radius:4px;border:none;padding:2px;color: #333;">
                    </label>
                    <label>片尾跳过秒数：
                        <input id="outroInput" type="number" min="0" step="1" value="${skipOutro}" style="width:60px;text-align:center;border-radius:4px;border:none;padding:2px;color: #333;">
                    </label>
                    <div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;">
                        <span>片尾偏好: <span id="prefStatus">${userPref || '未设置'}</span></span>
                        <button id="clearPref" style="background:#ff9800;color:#fff;border:none;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:11px;">重置</button>
                    </div>
                    <div style="display:flex;justify-content:space-between;gap:8px;margin-top:8px;">
                        <button id="saveSkip" style="flex:1;background:#2196f3;color:#fff;border:none;border-radius:4px;padding:4px;cursor:pointer;">保存</button>
                        <button id="closeSkip" style="flex:1;background:#555;color:#fff;border:none;border-radius:4px;padding:4px;cursor:pointer;">关闭</button>
                    </div>
                </div>
            `,
      style: {
        display: "none",
        position: "absolute",
        bottom: "50px",
        right: "20px",
        zIndex: 9999,
      },
    });

    function togglePanel() {
      const panel = layers.skipPanel;
      if (panel.style.display === "none") {
        panel.style.display = "block";
        // 更新输入框的值为当前设置
        setTimeout(() => {
          const introInput = document.getElementById("introInput");
          const outroInput = document.getElementById("outroInput");
          const prefStatus = document.getElementById("prefStatus");
          if (introInput) introInput.value = skipIntro;
          if (outroInput) outroInput.value = skipOutro;
          if (prefStatus) {
            const prefText = userPref === 'skip' ? '自动跳过' : 
                           userPref === 'no-skip' ? '不跳过' : '未设置';
            prefStatus.textContent = prefText;
          }
        }, 50);
      } else {
        panel.style.display = "none";
      }
    }

    function saveSettings() {
      const introVal = Number(document.getElementById("introInput").value);
      const outroVal = Number(document.getElementById("outroInput").value);
      skipIntro = introVal;
      skipOutro = outroVal;
      saveSkipSettings(); // 保存到localStorage
      notice.show = `跳过设置已更新：片头 ${skipIntro}s，片尾 ${skipOutro}s`;
      setTimeout(() => (notice.show = ""), 3000);
      layers.skipPanel.style.display = "none";
    }

    // ======== 控制栏按钮 ========
    controls.add({
      name: "skip-settings",
      position: "right",
      html: "⚙️ 跳过设置",
      tooltip: "设置片头片尾跳过",
      click: togglePanel,
      style: { cursor: "pointer", fontSize: "13px", padding: "2px 8px" },
    });

    // ======== 自动跳过片头 ========
    art.on("ready", () => {
      if (skipIntro > 0 && video.currentTime < skipIntro) {
        setTimeout(() => {
          video.currentTime = skipIntro;
          notice.show(`自动跳过 ${skipIntro} 秒片头`);
        }, 500);
      }
    });

    // ======== 片尾检测 ========
    art.on("video:timeupdate", () => {
      if (skipOutro > 0 && video.duration > 0 && !outroPromptShown) {
        const remainingTime = video.duration - video.currentTime;
        if (remainingTime <= skipOutro && remainingTime > 0) {
          outroPromptShown = true;
          if (userPref === "skip") {
            video.currentTime = video.duration - 1;
            notice.show = `根据偏好自动跳过片尾`;
            setTimeout(() => (notice.show = ""), 3000);
          } else if (userPref === "no-skip") {
            notice.show = `根据偏好保留片尾播放`;
            setTimeout(() => (notice.show = ""), 3000);
          } else if (autoConfirm) {
            video.currentTime = video.duration - 1;
            notice.show = `自动跳过片尾 (${skipOutro}s)`;
            setTimeout(() => (notice.show = ""), 3000);
          } else {
            showOutroPrompt();
          }
        }
      }
    });

    function showOutroPrompt() {
      // 添加片尾跳过提示层
      layers.add({
        name: "outroPrompt",
        html: `
          <div style="
            position: absolute;
            bottom: 20%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.6);
            color: #fff;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 14px;
            display: flex;
            gap: 8px;
            align-items: center;
            z-index: 9999;
          ">
            <span>是否跳过片尾？</span>
            <button id="outroYes" style="background:#2196f3;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">是</button>
            <button id="outroNo" style="background:#666;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">否</button>
          </div>
        `,
        style: {
          display: "block",
          position: "absolute",
          bottom: "0",
          left: "0",
          right: "0",
          top: "0",
          zIndex: 9999,
          pointerEvents: "none"
        }
      });

      // 初始化按钮事件
      setTimeout(() => {
        const yesBtn = document.getElementById("outroYes");
        const noBtn = document.getElementById("outroNo");
        
        if (yesBtn && noBtn) {
          // 启用按钮的指针事件
          yesBtn.style.pointerEvents = "auto";
          noBtn.style.pointerEvents = "auto";
          
          yesBtn.onclick = () => {
            saveUserPref("skip");
            video.currentTime = video.duration - 1;
            notice.show = `已跳过片尾，并记住此选择`;
            setTimeout(() => (notice.show = ""), 3000);
            layers.outroPrompt.style.display = "none";
          };
          
          noBtn.onclick = () => {
            saveUserPref("no-skip");
            notice.show = `保留片尾播放，并记住此选择`;
            setTimeout(() => (notice.show = ""), 3000);
            layers.outroPrompt.style.display = "none";
          };
        }
      }, 50);
    }

    function loadUserPref() {
      try {
        return localStorage.getItem(storageKey);
      } catch (e) {
        console.warn('无法加载用户偏好设置:', e);
        return null;
      }
    }
    
    function saveUserPref(pref) {
      try {
        localStorage.setItem(storageKey, pref);
        userPref = pref;
      } catch (e) {
        console.warn('无法保存用户偏好设置:', e);
      }
    }
    
    function clearUserPref() {
      try {
        localStorage.removeItem(storageKey);
        userPref = null;
      } catch (e) {
        console.warn('无法清除用户偏好设置:', e);
      }
    }

    // ======== 保存按钮事件 ========
    function initPanelEvents() {
      const saveBtn = document.getElementById("saveSkip");
      const closeBtn = document.getElementById("closeSkip");
      const clearPrefBtn = document.getElementById("clearPref");
      
      if (saveBtn && closeBtn && clearPrefBtn) {
        saveBtn.addEventListener("click", saveSettings);
        closeBtn.addEventListener("click", togglePanel);
        clearPrefBtn.addEventListener("click", () => {
          clearUserPref();
          notice.show = "已重置片尾偏好设置";
          setTimeout(() => (notice.show = ""), 2000);
          // 更新显示状态
          const prefStatus = document.getElementById("prefStatus");
          if (prefStatus) prefStatus.textContent = "未设置";
        });
      } else {
        // 如果DOM还没有渲染完成，稍后重试
        setTimeout(initPanelEvents, 100);
      }
    }

    // 等待DOM渲染后初始化事件
    setTimeout(initPanelEvents, 100);

    // ======== 重置片尾提示状态 ========
    art.on("seeked", () => {
      // 当用户手动跳转时，重置片尾提示状态
      outroPromptShown = false;
    });

    art.on("loadstart", () => {
      // 当开始加载新视频时，重置状态
      outroPromptShown = false;
    });

    return {
      name: "skipSectionsPlugin",
      setSkip(intro, outro) {
        skipIntro = intro;
        skipOutro = outro;
        saveSkipSettings(); // 保存设置
        notice.show = `更新跳过设置：片头 ${intro}s，片尾 ${outro}s`;
        setTimeout(() => (notice.show = ""), 3000);
      },
      getSkipSettings() {
        return { skipIntro, skipOutro, userPref };
      },
      getUserPref() {
        return userPref;
      },
      setUserPref(pref) {
        if (pref === 'skip' || pref === 'no-skip' || pref === null) {
          if (pref === null) {
            clearUserPref();
          } else {
            saveUserPref(pref);
          }
          notice.show = `片尾偏好已设置为: ${pref === 'skip' ? '自动跳过' : pref === 'no-skip' ? '不跳过' : '未设置'}`;
          setTimeout(() => (notice.show = ""), 2000);
        }
      },
      destroy() {
        controls.remove("skip-settings");
        layers.skipPanel && (layers.skipPanel.style.display = "none");
      },
    };
  };
}
