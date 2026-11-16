import type { SpectralMatrixAnalysis } from '@/lib/spectral-matrix';
import './spectral-matrix-panel.css';

const bandShortName = (index: number) => `B${index + 1}`;

function statusCopy(analysis: SpectralMatrixAnalysis): string {
  switch (analysis.status) {
    case 'sufficient':
      return `Pearson relationships estimated from ${analysis.frameCount} temporal frames.`;
    case 'insufficient_frames':
      return `Collect at least four frames; ${analysis.frameCount} available so far.`;
    case 'silent':
      return 'No measurable spectral intensity is available for this window.';
    case 'static':
      return 'The band profile stayed steady; temporal covariance is near zero.';
  }
}

export default function SpectralMatrixPanel({ analysis }: { analysis: SpectralMatrixAnalysis }) {
  const hasPrincipalMode = analysis.status === 'sufficient' &&
    analysis.principalVarianceShare != null;

  return (
    <section className="zc-spectral-matrix" aria-labelledby="zc-spectral-matrix-title" data-testid="spectral-matrix-panel">
      <div className="zc-spectral-matrix__heading">
        <div>
          <span className="zc-spectral-matrix__eyebrow">Local matrix analysis · 5 × 5</span>
          <h3 id="zc-spectral-matrix-title">Spectral relationship matrix</h3>
          <p>{statusCopy(analysis)}</p>
        </div>
        <span className={`zc-spectral-matrix__status zc-spectral-matrix__status--${analysis.status}`}>
          {analysis.status.replaceAll('_', ' ')}
        </span>
      </div>

      <div className="zc-spectral-matrix__formula" aria-label="Pearson correlation and principal covariance mode">
        <span>Rᵢⱼ = cov(Bᵢ, Bⱼ) / σᵢσⱼ</span>
        <span>λ₁ / tr(C)</span>
        <span>co-variation, not causation</span>
      </div>

      <div className="zc-spectral-matrix__table-scroll">
        <table className="zc-spectral-matrix__table" aria-label="Five-band spectral correlation matrix">
          <thead>
            <tr>
              <th scope="col">Band</th>
              {analysis.bandLabels.map((label, index) => (
                <th scope="col" key={label} title={label}>{bandShortName(index)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analysis.correlationMatrix.map((row, rowIndex) => (
              <tr key={analysis.bandLabels[rowIndex]}>
                <th scope="row" title={analysis.bandLabels[rowIndex]}>
                  <span>{bandShortName(rowIndex)}</span>
                  <small>{analysis.bandLabels[rowIndex]}</small>
                </th>
                {row.map((value, columnIndex) => {
                  const magnitude = Math.abs(value);
                  const tint = value >= 0
                    ? `rgba(185, 137, 58, ${0.08 + magnitude * 0.24})`
                    : `rgba(46, 111, 117, ${0.08 + magnitude * 0.24})`;
                  return (
                    <td
                      key={`${rowIndex}-${columnIndex}`}
                      style={{ backgroundColor: tint }}
                      aria-label={`${analysis.bandLabels[rowIndex]} against ${analysis.bandLabels[columnIndex]}: ${value.toFixed(2)}`}
                      title={`${analysis.bandLabels[rowIndex]} × ${analysis.bandLabels[columnIndex]} · r ${value.toFixed(2)}`}
                      data-testid={`spectral-matrix-cell-${rowIndex}-${columnIndex}`}
                    >
                      {value > 0 ? '+' : ''}{value.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="zc-spectral-matrix__footer">
        <div className="zc-spectral-matrix__legend" aria-label="Matrix color key">
          <span><i className="zc-spectral-matrix__swatch zc-spectral-matrix__swatch--positive" /> positive co-variation</span>
          <span><i className="zc-spectral-matrix__swatch zc-spectral-matrix__swatch--negative" /> inverse co-variation</span>
        </div>
        <p>
          Bands span equal portions of the sampled Nyquist range. Values are correlations of locally derived
          relative display intensity, not calibrated sound power or evidence of a particular source.
        </p>
      </div>

      <div className="zc-spectral-matrix__principal">
        <div>
          <span className="zc-spectral-matrix__eyebrow">Leading covariance mode</span>
          <strong>{hasPrincipalMode ? `${Math.round(analysis.principalVarianceShare! * 100)}%` : '—'}</strong>
          <small>variance share</small>
        </div>
        <div className="zc-spectral-matrix__vector" aria-label="Principal direction by frequency band">
          {analysis.principalDirection.map((value, index) => (
            <span key={analysis.bandLabels[index]} title={`${analysis.bandLabels[index]}: ${value.toFixed(3)}`}>
              <small>{bandShortName(index)}</small>
              <b>{hasPrincipalMode ? value.toFixed(2) : '—'}</b>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
