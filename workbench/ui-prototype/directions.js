const descriptions = {
  paper: '01 / 墨白极简：用明度、字重和留白建立层级；主按钮用墨黑，彩色只留给执行状态。不用大面积渐变或宣传区。',
  graphite: '02 / 石墨深色：深灰而非纯黑，用层次区分导航、表格和详情；青柠仅强调主操作。气质更接近开发工具，不默认认为它比浅色更护眼。',
  navy: '03 / 深蓝分区：用深色侧栏固定导航，白色内容区承载工作；蓝色仅用于主操作，不再把整页铺成浅蓝紫。',
};
document.querySelectorAll('[data-theme-choice]').forEach(button => {
  button.addEventListener('click', () => {
    const theme = button.dataset.themeChoice;
    if (!Object.hasOwn(descriptions, theme)) return;
    document.body.dataset.theme = theme;
    document.querySelectorAll('[data-theme-choice]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    document.querySelector('#rationale').textContent = descriptions[theme];
  });
});
