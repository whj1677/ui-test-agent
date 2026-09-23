import { expect, test } from '@playwright/test';

test('独立录制页的视觉状态对应真实 test.step 边界', async ({ page }) => {
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    html,body,#board{margin:0;width:100%;height:100%;font:700 48px sans-serif}#board{display:grid;place-items:center;color:white}
    #label{position:absolute;top:30px;left:30px}button{position:absolute;top:100px;left:30px;font-size:20px}
    #clock{position:absolute;bottom:0;left:0;width:100%;height:38%;display:grid;place-items:center;font:700 26px monospace;color:white}
  </style><main id="board" style="background:#334155"><span id="label">CAL_STATE_0</span>
    <button data-state="1">状态一</button><button data-state="2" style="left:150px">状态二</button>
  <button data-state="3" style="left:270px">状态三</button><button data-state="4" style="left:390px">状态四</button>
  <div id="clock">视觉校准时标</div></main><script>
    const clock=document.querySelector('#clock'); const clockStart=performance.now();
    setInterval(()=>{const tick=Math.floor((performance.now()-clockStart)/80);clock.style.backgroundColor='hsl('+((tick*67)%360)+' 85% 42%)';clock.textContent='CAL_CLOCK_'+String(tick).padStart(3,'0')},16);
    document.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{
      const state=button.dataset.state; const colors={1:'#b91c1c',2:'#047857',3:'#7e22ce',4:'#0369a1'};
      document.querySelector('#board').style.background=colors[state];
      document.querySelector('#label').textContent='CAL_STATE_'+state;
    }));
  </script>`);
  await expect(page.locator('#label')).toHaveText('CAL_STATE_0');
  await page.waitForTimeout(500); // Explicit calibration-only startup delay.
  await test.step('CAL_STEP_1 画面变红', async () => {
    await page.getByRole('button', { name: '状态一' }).click();
    await expect(page.locator('#label')).toHaveText('CAL_STATE_1');
    await page.waitForTimeout(300);
  });
  await test.step('CAL_STEP_2 画面变绿', async () => {
    await page.getByRole('button', { name: '状态二' }).click();
    await expect(page.locator('#label')).toHaveText('CAL_STATE_2');
    await page.waitForTimeout(300);
  });
  await test.step('CAL_STEP_3 画面变紫', async () => {
    await page.getByRole('button', { name: '状态三' }).click();
    await expect(page.locator('#label')).toHaveText('CAL_STATE_3');
    await page.waitForTimeout(300);
  });
  await test.step('CAL_STEP_4 画面变青', async () => {
    await page.getByRole('button', { name: '状态四' }).click();
    await expect(page.locator('#label')).toHaveText('CAL_STATE_4');
    await page.waitForTimeout(300);
  });
});
