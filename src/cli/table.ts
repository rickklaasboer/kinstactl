const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

function visibleWidth(s: string): number {
    return s.replace(ANSI, '').length;
}

/** Pads columns to their widest cell; the last column is left unpadded. Cells may contain ANSI codes. */
export function renderTable(headers: string[], rows: string[][]): string {
    const widths = headers.map((h, i) =>
        Math.max(visibleWidth(h), ...rows.map((r) => visibleWidth(r[i] ?? ''))),
    );
    const line = (cells: string[]) =>
        cells
            .map((c, i) =>
                i === cells.length - 1
                    ? c
                    : c + ' '.repeat(widths[i]! - visibleWidth(c)),
            )
            .join('  ');
    return [line(headers), ...rows.map(line)].join('\n');
}
