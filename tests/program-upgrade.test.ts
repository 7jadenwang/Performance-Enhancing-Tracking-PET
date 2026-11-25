import { it, expect } from 'vitest';
import { program } from '../src/program/catalog';
it('includes all source images and both supplied tracks without duplicate sessions', () => {
  expect(program.sources).toHaveLength(160);
  expect(program.sessions).toHaveLength(135);
  expect(new Set(program.sessions.map(s=>s.id)).size).toBe(135);
  expect(program.sessions.filter(s=>s.programId === 'up')).toHaveLength(78);
});
it('adds separate September and October phases and keeps the October add-on elective', () => {
  const [september, october] = program.definitions.find(p=>p.id === 'up')!.phases.slice(2);
  expect(september.entrySessionIds).toEqual(['Sept-W1D1', 'Sept-W2D1', 'Sept-W3D1', 'Sept-W4D2']);
  expect(october.entrySessionIds).toEqual(['Oct-W1D1', 'Oct-W2D1', 'Oct-W3D1', 'Oct-W4D1']);
  expect(september.purpose).not.toBe(october.purpose);
  const session = program.sessions.find(s=>s.id === 'Oct-W4D2')!;
  expect(session.optional).toBe(false);
  expect(session.sources).toHaveLength(2);
  expect(session.exercises.filter(p=>p.optional)).toHaveLength(12);
  expect(program.sessions.find(s=>s.id === 'Oct-W3D1')?.sourceConflict).toContain('第二周第六天');
  expect(program.sessions.find(s=>s.id === 'Oct-W4D5')?.sourceConflict).toContain('第四周第四天');
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
