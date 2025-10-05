<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>P2Pチャット（サーバーなし）</title>
<style>
body{font-family:sans-serif;background:#f3f3f3;padding:20px;}
#chat{max-width:600px;margin:auto;background:white;border-radius:10px;padding:20px;box-shadow:0 0 10px rgba(0,0,0,0.1);}
#log{border:1px solid #ccc;height:300px;overflow-y:auto;padding:10px;margin-bottom:10px;background:#fafafa;}
.msg{margin:5px 0;padding:6px 10px;border-radius:5px;max-width:80%;}
.me{background:#d1ffd6;margin-left:auto;}
.other{background:#eee;}
.system{color:#777;font-size:0.9em;text-align:center;}
.flex{display:flex;gap:5px;}
input,textarea,button{width:100%;padding:8px;box-sizing:border-box;}
textarea{height:100px;}
</style>
</head>
<body>
<div id="chat">
  <h2>🌐 サーバーなしP2Pチャット</h2>
  <div id="log"></div>

  <div class="flex">
    <input id="name" placeholder="あなたの名前">
  </div>
  <div class="flex">
    <input id="msg" placeholder="メッセージを入力">
    <button id="send">送信</button>
  </div>

  <h3>接続手順</h3>
  <button id="makeOffer">オファーを作成（最初の人）</button>
  <button id="makeAnswer">アンサーを作成（参加する人）</button>

  <textarea id="signal" placeholder="オファーまたはアンサーのデータを貼り付け／コピー"></textarea>
  <div class="flex">
    <button id="copy">コピー</button>
    <button id="connect">接続</button>
  </div>
</div>

<script>
let pc, channel;
const servers = {iceServers:[{urls:"stun:stun.l.google.com:19302"}]};
const logDiv = document.getElementById("log");

function addLog(text, cls="system"){
  const div = document.createElement("div");
  div.className = "msg " + cls;
  div.textContent = text;
  logDiv.appendChild(div);
  logDiv.scrollTop = logDiv.scrollHeight;
}

// 送信処理
document.getElementById("send").onclick = () => {
  if(!channel || channel.readyState !== "open") return;
  const name = document.getElementById("name").value.trim() || "匿名";
  const text = document.getElementById("msg").value.trim();
  if(!text) return;
  const msg = {name, text};
  channel.send(JSON.stringify(msg));
  addLog(`${name}: ${text}`, "me");
  document.getElementById("msg").value = "";
};

// オファー作成
document.getElementById("makeOffer").onclick = async () => {
  pc = new RTCPeerConnection(servers);
  channel = pc.createDataChannel("chat");
  setupChannel(channel);
  pc.onicecandidate = e => {
    if(!e.candidate){
      document.getElementById("signal").value = JSON.stringify(pc.localDescription);
    }
  };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  addLog("オファーを生成しました。相手に渡してください。");
};

// アンサー作成
document.getElementById("makeAnswer").onclick = () => {
  pc = new RTCPeerConnection(servers);
  pc.ondatachannel = e => {
    channel = e.channel;
    setupChannel(channel);
  };
  pc.onicecandidate = e => {
    if(!e.candidate){
      document.getElementById("signal").value = JSON.stringify(pc.localDescription);
    }
  };
  addLog("オファーを貼り付けて『接続』を押してください。");
};

// 接続ボタン
document.getElementById("connect").onclick = async () => {
  const text = document.getElementById("signal").value.trim();
  if(!text) return alert("接続データを入力してください。");
  const desc = JSON.parse(text);
  await pc.setRemoteDescription(desc);
  if(desc.type === "offer"){
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
  }
  addLog("接続処理中...");
};

// コピーボタン
document.getElementById("copy").onclick = () => {
  navigator.clipboard.writeText(document.getElementById("signal").value);
  alert("コピーしました！");
};

// データチャネル
function setupChannel(ch){
  channel = ch;
  channel.onopen = () => addLog("✅ 接続成功！チャットを開始できます。");
  channel.onmessage = e => {
    const data = JSON.parse(e.data);
    addLog(`${data.name}: ${data.text}`, "other");
  };
}
</script>
</body>
</html>
