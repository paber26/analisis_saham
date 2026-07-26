// Shared selected simulation date across the whole Simulasi Lab. Every lab page
// (wizard, kondisi-pasar, riwayat) reads/writes this one value so the chosen
// date is a single global context.
export const useSimDate = () =>
  useState<string>('sim-selected-date', () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0]!;
  });
