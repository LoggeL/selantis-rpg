import { expect, type Page } from '@playwright/test';

/** Solve through actual controls; diagnostic registry reads never set progress. */
export async function solveTracking(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Flicks Fährte', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Hufabdrücke untersuchen', exact: true }).click();
  await dialog.getByRole('button', { name: 'Rindenspur untersuchen', exact: true }).click();
  await dialog.getByRole('button', { name: 'Rechts hinter der Wurzel folgen', exact: true }).click();
  await expect(dialog).toHaveAttribute('data-phase', 'solved');
  await dialog.getByRole('button', { name: 'Der Spur folgen', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
