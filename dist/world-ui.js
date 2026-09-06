export function setupUI({ visit, home, growRandom }) {
  const dialog = document.getElementById('place-dialog');
  const content = document.getElementById('panel-content');
  const helpDialog = document.getElementById('help-dialog');
  const toastEl = document.getElementById('toast');
  let toastTimer, audio, ambientGain, ambientOn = false, sequencer = null, current = null;
  const notes = [261.63, 293.66, 329.63, 392, 440];
  const passages = [
    ['如果宇宙是一颗卷心菜，每剥开一层，都会发现自己还在里面。', '今日观察 · 关于层次'],
    ['想法暂时没有结果的时候，也许正在地下长根。', '今日观察 · 关于生长'],
    ['河流从不检查自己的待办清单。它流经的地方，已经足够多了。', '今日观察 · 关于时间'],
    ['这里的图书馆允许走神。走神有时是另一种检索方式。', '今日观察 · 关于好奇'],
    ['把一个问题种在这里。明天它可能长成另一个更好的问题。', '今日观察 · 关于问题']
  ];
  let passageIndex = 0, ideaIndex = 0;
  const ideas = [
    '一座把梦境当作天气预报的气象站。今晚，局部有飞鱼。',
    '一只只负责提出好问题的机器人。答案让卷心菜们慢慢讨论。',
    '一间用脑洞大小计租金的温室。今天你可能付不起房租。',
    '把每一次「我不懂」种进土里，观察它最后长成什么。',
    '一条会记住旅人的河流。每次经过，都流出一点不一样的旋律。',
    '用树的年轮保存一个人的修改记录。后悔的时候，可以开一个新分支。'
  ];
  function toast(text) { clearTimeout(toastTimer);toastEl.textContent=text;toastEl.classList.add('show');toastTimer=setTimeout(()=>toastEl.classList.remove('show'),3400); }
  function ensureAudio() {
    if (!audio) { const Context=window.AudioContext||window.webkitAudioContext;if(!Context){toast('当前浏览器暂不支持声音，仍然可以探索小岛。');return null;}audio=new Context(); }
    if (audio.state==='suspended') audio.resume();return audio;
  }
  function note(frequency,duration=.9,volume=.13) {
    const ctx=ensureAudio();if(!ctx)return;const now=ctx.currentTime;
    const gain=ctx.createGain();gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(volume,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);gain.connect(ctx.destination);
    const osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=frequency;osc.connect(gain);osc.start();osc.stop(now+duration+.05);
    const harmonic=ctx.createOscillator(),hg=ctx.createGain();harmonic.frequency.value=frequency*2;hg.gain.value=.22;harmonic.connect(hg);hg.connect(gain);harmonic.start();harmonic.stop(now+duration+.05);
    osc.onended=()=>{osc.disconnect();harmonic.disconnect();hg.disconnect();gain.disconnect();};
  }
  function ambient() {
    const ctx=ensureAudio();if(!ctx)return;
    if(!ambientGain){ambientGain=ctx.createGain();ambientGain.gain.value=0;ambientGain.connect(ctx.destination);const n=ctx.sampleRate*4,buf=ctx.createBuffer(1,n,ctx.sampleRate),data=buf.getChannelData(0);let prev=0;for(let i=0;i<n;i++){const v=Math.random()*2-1;prev=(prev+.025*v)/1.025;data[i]=prev*4.0;}
      const noise=ctx.createBufferSource();noise.buffer=buf;noise.loop=true;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1200;noise.connect(lp);lp.connect(ambientGain);noise.start();
      for(const f of [130.81,196,261.63]){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=f;g.gain.value=.025;o.connect(g);g.connect(ambientGain);o.start();}
    }
    ambientOn=!ambientOn;ambientGain.gain.setTargetAtTime(ambientOn?.23:0,ctx.currentTime,.35);document.getElementById('sound').setAttribute('aria-pressed',String(ambientOn));document.getElementById('sound').title=ambientOn?'关闭环境声音':'开启环境声音';document.querySelector('#sound .optional').textContent=ambientOn?'聆听':'声音';toast(ambientOn?'听见了吗？水在流，想法在长。':'环境声音已关闭。');
  }
  function stopSequence(){if(sequencer){clearInterval(sequencer);sequencer=null;}const b=document.getElementById('melody');if(b)b.textContent='♫ 让它自己弹一会儿';}
  function close(){stopSequence();current=null;dialog.close();}
  document.querySelectorAll('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  dialog.addEventListener('close',()=>{current=null;stopSequence();});
  for(const d of [dialog,helpDialog])d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
  document.getElementById('help').addEventListener('click',()=>helpDialog.showModal());
  document.getElementById('sound').addEventListener('click',ambient);
  document.querySelectorAll('[data-place]').forEach(b=>b.addEventListener('click',()=>visit(b.dataset.place)));
  function open(key) {
    stopSequence();current=key;
    if(key==='heart'){
      content.innerHTML='<span class="panel-icon">✳</span><div class="panel-kicker">01 / THE HEART OF CABBAGELAND</div><h2>万物皆可长成卷心菜。</h2><p>这颗巨大的卷心菜是小岛的心脏。瀑布把它的奇思妙想带到书报亭、音乐角、实验室和画廊。</p><p>你也可以种一点。点击菜地里的小卷心菜，给它浇水，它会一点点长大。</p><button class="action" id="explore-garden">去菜地逛逛 <span>✿</span></button>';
      document.getElementById('explore-garden').onclick=()=>{close();home();toast('试着点一下小卷心菜。每颗都可以浇水三次。');};
    } else if(key==='read') {
      content.innerHTML='<span class="panel-icon">▤</span><div class="panel-kicker">02 / ESCAPE THE VOID</div><h2>给走神留一页。</h2><p class="quote" id="reading-text"></p><p class="panel-meta" id="reading-meta"></p><button class="action" id="next-page">翻开另一页 <span>↗</span></button><p class="panel-meta">Cabbageland 小报 · 原创随想</p>';
      function showPassage(){document.getElementById('reading-text').textContent=passages[passageIndex%passages.length][0];document.getElementById('reading-meta').textContent=passages[passageIndex%passages.length][1];}
      showPassage();document.getElementById('next-page').onclick=()=>{passageIndex++;showPassage();};
    } else if(key==='music') {
      content.innerHTML='<span class="panel-icon">♫</span><div class="panel-kicker">03 / COMPOSE BOREDOM</div><h2>无聊也可以有旋律。</h2><p>五颗音符，随便弹。<br>这座岛暂时没有乐评人。</p><div class="piano">'+notes.map((n,i)=>'<button data-note="'+i+'" aria-label="弹奏 '+['Do','Re','Mi','Sol','La'][i]+'">'+['Do','Re','Mi','Sol','La'][i]+'</button>').join('')+'</div><p class="panel-meta">键盘 A · S · D · F · G 也可以演奏。</p><button class="action" id="melody">♫ 让它自己弹一会儿</button>';
      document.querySelectorAll('[data-note]').forEach(b=>b.addEventListener('click',()=>playKey(Number(b.dataset.note))));
      document.getElementById('melody').onclick=()=>{if(sequencer){stopSequence();return;}let step=0;const melody=[0,2,3,4,3,2,1,2,0,2,4,3,2,1,0,3];playKey(melody[step++]);sequencer=setInterval(()=>playKey(melody[step++%melody.length]),440);document.getElementById('melody').textContent='Ⅱ 停在这里';};
    } else if(key==='nerd') {
      content.innerHTML='<span class="panel-icon">⌘</span><div class="panel-kicker">04 / NERD\'S FARM</div><h2>今天种什么脑洞？</h2><p>实验室的土壤很适合一些离谱的小想法。</p><div class="idea-output" id="idea"></div><button class="action" id="new-idea">换一颗种子 ⟳</button> <button class="action secondary" id="plant-idea">种下它 ✿</button><p class="panel-meta">种下一个想法，岛上的一颗卷心菜就会长大。</p>';
      document.getElementById('idea').textContent=ideas[ideaIndex%ideas.length];document.getElementById('new-idea').onclick=()=>{ideaIndex++;document.getElementById('idea').textContent=ideas[ideaIndex%ideas.length];};document.getElementById('plant-idea').onclick=()=>{close();growRandom();home();};
    } else if(key==='art') {
      content.innerHTML='<span class="panel-icon">◈</span><div class="panel-kicker">05 / MY WORLD IN XD</div><h2>一张图，长成一个世界。</h2><a href="./cabbageland-reference.jpeg" target="_blank" rel="noopener" aria-label="查看完整的 Cabbageland 原图"><img class="gallery-image" src="./cabbageland-reference.jpeg" alt="Cabbageland 原始参考图：卷心菜瀑布、玻璃温室和四个创意小店。"></a><p>这就是小岛的起点。平面里的河流、菜地和小店，在这里有了另一个角度。</p><p class="panel-meta">点击画作查看原图；关闭窗口后，拖动场景发现新的角度。</p>';
    }
    if(!dialog.open)dialog.showModal();
    dialog.scrollTop=0;
  }
  function playKey(i){note(notes[i],1.2);const b=document.querySelector('[data-note="'+i+'"]');if(b){b.classList.add('playing');setTimeout(()=>b.classList.remove('playing'),180);}}
  document.addEventListener('keydown',e=>{if(current!=='music'||!dialog.open||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;const i='asdfg'.indexOf(e.key.toLowerCase());if(i>=0){e.preventDefault();playKey(i);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopSequence();audio?.suspend();}else if(ambientOn)audio?.resume();});
  return { open, toast, note };
}
