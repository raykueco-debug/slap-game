// 部件設定（角色座標：腰＝原點，往上為負）
// parent：掛在哪個部件上（跟著它動）
// x,y：樞紐在父部件座標中的位置
// ax,ay：樞紐在圖片上的位置（0~1，左上=0,0）
// w：畫出寬度；留 null ＝ 依圖片原尺寸等比（以 head 寬 HEAD_UNIT_W 為基準），GPT 同比例畫的部件會自動對上比例
// 圖片不存在時自動用程式畫的佔位角色
// 對位：網址加 ?edit 進編輯模式拖曳，按「複製設定」貼回這裡
window.PARTS = {
  legs:      {parent:'root',  img:'parts/legs.png',       x:0,   y:-6,   ax:0.5, ay:0.0,  w:null},
  torso:     {parent:'root',  img:'parts/torso.png',      x:0,   y:14,   ax:0.5, ay:1.0,  w:null},
  torsoCollar:{parent:'torso', img:'parts/torso_collar.png', x:0, y:0,   ax:0.5, ay:1.0,  w:null},
  armL:      {parent:'torso', img:'parts/arm_left.png',   x:-68, y:-150, ax:0.62,ay:0.08, w:null},
  armR:      {parent:'torso', img:'parts/arm_right.png',  x:68,  y:-150, ax:0.38,ay:0.08, w:null},
  head:      {parent:'torso', img:'parts/head.png',       x:0,   y:-166, ax:0.5, ay:0.97, w:null},
  hairBack:  {parent:'head',  img:'parts/hair_back.png',  x:0,   y:-118, ax:0.5, ay:0.5,  w:null},
  face:      {parent:'head',  img:'parts/face_smug.png',  x:0,   y:-62,  ax:0.5, ay:0.5,  w:null},
  faceHurt:  {parent:'head',  img:'parts/face_hurt.png',  x:0,   y:-62,  ax:0.5, ay:0.5,  w:null},
  hairFront: {parent:'head',  img:'parts/hair_front.png', x:0,   y:-232, ax:0.5, ay:0.0,  w:null},
};
// 繪製順序（後面的蓋前面）
// torso（含後領）→ head（脖子）→ torsoCollar（翻領／V領邊蓋住脖子下緣）→ 手 → 臉、前髮
// 五官畫在前髮之上（瀏海不蓋眼睛）
window.DRAW_ORDER = ['hairBack','legs','torso','head','torsoCollar','armL','armR','hairFront','face','faceHurt'];
window.HEAD_UNIT_W = 230; // 頭的基準寬（角色座標）
// 版面（角色座標）：top＝頭頂、feet＝腳底、headY＝頭中心、neckY＝脖子
window.LAYOUT = { top: -450, feet: 205, headY: -315, neckY: -200 };
