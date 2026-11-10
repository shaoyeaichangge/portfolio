// 在数组中逐项添加作品，排列顺序就是网页的展示顺序。
// 每项填写 title（标题）、category（分类）、summary（简介）。
// cover 为封面图片路径，url 为作品页面或文件地址，两者都可留空。
// coverFit 设为 "contain" 可完整显示封面，linkLabel 可自定义查看提示。
// 图集可用 images 列出各张图的 title（图名）和 url（大图路径），可另填 thumbnail（缩略图路径）。
// 图片和文件可放在本站目录中，以相对路径引用。
window.PORTFOLIO_WORKS = [
  {
    title: "科研项目可视化",
    category: "项目绘图与可视化",
    summary: "这两张图是我在科研项目里画的。一张讲数据怎么一步步分析，另一张讲各个模块怎么接起来。",
    images: [
      {
        title: "科研项目流程",
        url: "./assets/research-workflow-redacted.png",
        thumbnail: "./assets/research-workflow-redacted-thumb.webp"
      },
      {
        title: "多模块技术架构",
        url: "./assets/technical-architecture-redacted.png",
        thumbnail: "./assets/technical-architecture-redacted-thumb.webp"
      }
    ]
  },
  {
    title: "车间布局和算法示意图",
    category: "项目绘图与可视化",
    summary: "我画了车间的作业区和搬运路线，还用鸟群的例子解释粒子群算法。这几张图来自我的本科论文。",
    images: [
      { title: "研究技术路线", url: "./works/thesis-diagrams/research-roadmap.png" },
      { title: "作业单元坐标", url: "./works/thesis-diagrams/unit-coordinates.png" },
      { title: "物流搬运路线", url: "./works/thesis-diagrams/logistics-routes.png" },
      { title: "粒子群算法原理", url: "./works/thesis-diagrams/particle-swarm.png" }
    ]
  }
];

// 仿真结果按类别放在这里。补充 images 后，预留卡片会显示对应图集。
// 每张图填写 title 和 url，需要时再加 thumbnail。
window.PORTFOLIO_SIMULATIONS = [
  { title: "流体仿真", images: [] },
  { title: "结构仿真", images: [] },
  { title: "顺序仿真", images: [] }
];
