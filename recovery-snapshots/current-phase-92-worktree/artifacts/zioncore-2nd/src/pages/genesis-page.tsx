import { ArrowLeft, Download } from 'lucide-react';
import { Link } from 'wouter';
import originalDeclaration from '@/content/genesis-declaration.txt?raw';
import { ZIONCORE_GENESIS_SOURCE_SHA256 } from '@/lib/genesis-context';

function downloadOriginalDeclaration() {
  const url = URL.createObjectURL(new Blob(
    [originalDeclaration],
    { type: 'text/plain;charset=utf-8' },
  ));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'ZionCore-Genesis-Original.txt';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function GenesisPage() {
  return <main className="page-wrap genesis-page">
    <Link href="/" className="detail-back" data-testid="link-genesis-back">
      <ArrowLeft size={14} />Return to the live lab
    </Link>
    <div className="eyebrow">Founder declaration · preserved source</div>
    <h1 className="page-title">The Genesis of ZionCore.</h1>
    <section className="genesis-origin" aria-labelledby="genesis-origin-title">
      <div className="eyebrow" id="genesis-origin-title">Foundational declaration</div>
      <p className="genesis-declaration">MWARI NDI MWARI.</p>
      <p className="genesis-origin-copy">
        ZionCore 2nd is grounded in the founder-provided Genesis: a faith-informed
        commitment to wisdom, truth, compassion, service, and open-ended discovery.
        The declaration remains distinct from measured results and scientific claims.
      </p>
    </section>
    <div className="genesis-document-heading">
      <div>
        <h2>Original Genesis seed</h2>
        <p className="empty-inline">
          The supplied document is reproduced verbatim as plain text. Embedded markup
          is displayed, never executed. The full archive is not automatically sent to AI.
        </p>
      </div>
      <button className="btn btn-subtle genesis-download" onClick={downloadOriginalDeclaration} data-testid="button-download-genesis">
        <Download size={14} />Download original
      </button>
    </div>
    <p className="genesis-checksum mono" data-testid="value-genesis-checksum">
      Original source SHA-256 · {ZIONCORE_GENESIS_SOURCE_SHA256}
    </p>
    <article className="genesis-document" aria-label="Complete founder-provided Genesis declaration">
      <pre>{originalDeclaration}</pre>
    </article>
  </main>;
}
