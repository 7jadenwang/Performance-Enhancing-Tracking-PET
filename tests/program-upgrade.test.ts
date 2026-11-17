import { it, expect } from 'vitest';
import { program } from '../src/program/catalog';
it('includes all source images and both supplied tracks without duplicate sessions', () => {
  expect(program.sources).toHaveLength(119);
  expect(program.sessions).toHaveLength(95);
  expect(new Set(program.sessions.map(s=>s.id)).size).toBe(95);
  expect(program.sessions.filter(s=>s.programId === 'up')).toHaveLength(38);
});
it('uses purpose labels and preserves source identity and exceptions', () => {
  expect(program.definitions.map(p=>p.id)).toEqual(['lp','up']);
  expect(program.definitions[0].phases[0].purpose).toBe('Force–Power Development');
  expect(program.sessions.find(s=>s.id==='April-W1D1')).toBeDefined();
  expect(program.sessions.find(s=>s.id==='July-W3D7')?.optional).toBe(true);
  expect(program.sessions.find(s=>s.id==='August-W2D1')?.autoregulation).toBe('none');
  expect(program.sessions.find(s=>s.id==='August-W1D3')?.sourceConflict).toContain('第四天');
  expect(program.sessions.find(s=>s.id==='July-W3D2')?.conditionalSources).toHaveLength(1);
});
