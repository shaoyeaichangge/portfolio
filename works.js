// 在数组中逐项添加作品，排列顺序就是网页的展示顺序。
// 每项填写 title（标题）、category（分类）、summary（简介）。
// cover 为封面图片路径，url 为作品页面或文件地址，两者都可留空。
// coverFit 设为 "contain" 可完整显示封面，linkLabel 可自定义查看提示。
// 图集可用 images 列出各张图的 title（图名）和 url（图片路径）。
// 图片和文件可放在本站目录中，以相对路径引用。
window.PORTFOLIO_WORKS = [
  {
    title: "科研项目可视化",
    category: "项目绘图与可视化",
    summary: "用多栏布局、图表与流程箭头，呈现科研项目的技术路线和多模块之间的信息流向。",
    images: [
      { title: "科研项目流程", url: "./assets/research-workflow-redacted.png" },
      { title: "多模块技术架构", url: "./assets/technical-architecture-redacted.png" }
    ]
  },
  {
    title: "复杂问题的图解表达",
    category: "项目绘图与可视化",
    summary: "用几何标注、线型、图形类比和分层流程图，讲清空间关系、物流路径、算法原理与研究思路。",
    images: [
      { title: "研究技术路线", url: "./works/thesis-diagrams/research-roadmap.png" },
      { title: "作业单元坐标", url: "./works/thesis-diagrams/unit-coordinates.png" },
      { title: "物流搬运路线", url: "./works/thesis-diagrams/logistics-routes.png" },
      { title: "粒子群算法原理", url: "./works/thesis-diagrams/particle-swarm.png" }
    ]
  }
];
