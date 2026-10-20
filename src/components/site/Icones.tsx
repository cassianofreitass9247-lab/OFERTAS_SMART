// Ícones desenhados em traço, no estilo da Vitrine. Todos decorativos (aria-hidden):
// o texto ou o aria-label do botão é que diz o que ele faz.

type P = { tamanho?: number; className?: string };
const base = (t: number) => ({ width: t, height: t, viewBox: "0 0 24 24", "aria-hidden": true as const });
const traco = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const CAMINHO_CORACAO =
  "M12 21s-7.5-4.6-9.3-9.2C1.5 8.6 3.6 5 7 5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.4 0 5.5 3.6 4.3 6.8C19.5 16.4 12 21 12 21z";

export function IconeCoracao({ tamanho = 22, preenchido = true, className }: P & { preenchido?: boolean }) {
  return (
    <svg {...base(tamanho)} className={className}>
      <path d={CAMINHO_CORACAO} fill={preenchido ? "#ff3d6e" : "#ffffff"} stroke="#1e120c" strokeWidth={2} />
    </svg>
  );
}

export function IconeEstrela({ tamanho = 18, className }: P) {
  return (
    <svg {...base(tamanho)} className={className}>
      <path d="M12 2l2.6 6.6L21 9.3l-5 4.4 1.6 6.8L12 17l-5.6 3.5L8 13.7 3 9.3l6.4-.7z" fill="#ffe14d" stroke="#1e120c" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

export function IconeBrilho({ tamanho = 22, className }: P) {
  return (
    <svg {...base(tamanho)} className={className}>
      <path d="M12 2l2 6.5L20.5 10 14 12l-2 6.5L10 12 3.5 10 10 8.5z" fill="#ffe14d" stroke="#1e120c" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9z" fill="#ffe14d" stroke="#1e120c" strokeWidth={1.2} strokeLinejoin="round" />
    </svg>
  );
}

export const IconeBusca = ({ tamanho = 20 }: P) => (
  <svg {...base(tamanho)} {...traco} strokeWidth={2.4}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
);
export const IconeSeta = ({ tamanho = 20 }: P) => (
  <svg {...base(tamanho)} {...traco} strokeWidth={2.5}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconeSaida = ({ tamanho = 20 }: P) => (
  <svg {...base(tamanho)} {...traco} strokeWidth={2.5}><path d="M7 17L17 7M9 7h8v8" /></svg>
);
export const IconeSino = ({ tamanho = 18 }: P) => (
  <svg {...base(tamanho)} {...traco}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
);
export const IconeTelegram = ({ tamanho = 20 }: P) => (
  <svg {...base(tamanho)} {...traco} strokeWidth={2}><path d="M21 4L3 11l6 2.5L11 20l3.5-4.5L19 19z" /><path d="M9 13.5l8-6" /></svg>
);
export const IconeInstagram = ({ tamanho = 20 }: P) => (
  <svg {...base(tamanho)} {...traco} strokeWidth={2}>
    <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
  </svg>
);
export const IconeWhatsapp = ({ tamanho = 20 }: P) => (
  <svg {...base(tamanho)} {...traco} strokeWidth={2}>
    <path d="M4 20l1.3-4A8 8 0 1 1 8.5 19z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8c-.9-.4-1.6-1.1-2-2l.8-1-1-2z" strokeWidth={1.6} />
  </svg>
);
export const IconeEscudo = ({ tamanho = 16 }: P) => (
  <svg {...base(tamanho)} {...traco} stroke="#ffe14d"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>
);
export const IconeQueda = ({ tamanho = 16 }: P) => (
  <svg {...base(tamanho)} {...traco} stroke="#ffe14d"><path d="M3 7l6 6 4-4 8 8" /><path d="M15 17h6v-6" /></svg>
);
export const IconeRelogio = ({ tamanho = 16 }: P) => (
  <svg {...base(tamanho)} {...traco} stroke="#ffe14d"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const IconeEtiqueta = ({ tamanho = 18 }: P) => (
  <svg {...base(tamanho)} {...traco}><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" /></svg>
);
export const IconeCupom = ({ tamanho = 18 }: P) => (
  <svg {...base(tamanho)} {...traco}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" /><path d="M14 6v2M14 11v2M14 16v2" /></svg>
);
export const IconeFoto = ({ tamanho = 34 }: P) => (
  <svg {...base(tamanho)} fill="none" stroke="#1e120c" strokeWidth={1.6} strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>
);

/** Ícone por categoria, escolhido pelo nome (slug). Categoria desconhecida usa a etiqueta. */
export function IconeCategoria({ slug, tamanho = 18 }: { slug: string; tamanho?: number }) {
  if (/casa|cozinha|lar|decor/.test(slug)) {
    return <svg {...base(tamanho)} {...traco}><path d="M3 9.5L12 4l9 5.5V20H3z" /><path d="M9 20v-6h6v6" /></svg>;
  }
  if (/beleza|make|maquiagem|cabelo|skin/.test(slug)) {
    return (
      <svg {...base(tamanho)} {...traco}>
        <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z" /><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
      </svg>
    );
  }
  if (/infantil|crianca|bebe|kids|brinquedo/.test(slug)) {
    return <svg {...base(tamanho)} {...traco}><circle cx="12" cy="9" r="6" /><path d="M12 15c-.8 1.5-.8 3 0 4.5s.8 2 0 2.5" /><path d="M10.5 15h3" /></svg>;
  }
  if (/eletr|celular|tech|informatica|audio|video/.test(slug)) {
    return <svg {...base(tamanho)} {...traco}><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M10.5 18.5h3" /></svg>;
  }
  if (/moda|roupa|bolsa|acessorio|calcado/.test(slug)) {
    return <svg {...base(tamanho)} {...traco}><path d="M6 8h12l1 13H5z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>;
  }
  return <IconeEtiqueta tamanho={tamanho} />;
}

/** Marca da Vitrine: selo com a sacola de compras, estrela e coração. Mesmo desenho de src/app/icon.svg. */
export function Marca({ tamanho = 56 }: P) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 56 56" aria-hidden="true">
      <rect x="2" y="2" width="52" height="52" rx="16" fill="#ffffff" stroke="#1e120c" strokeWidth="3" />
      <path d="M37 24l7 3 1 18-6 2z" fill="#c2410c" stroke="#1e120c" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M13 24h24l2 23H11z" fill="#ff5b14" stroke="#1e120c" strokeWidth="2.6" strokeLinejoin="round" />
      <circle cx="18" cy="28" r="1.9" fill="#1e120c" />
      <circle cx="30" cy="28" r="1.9" fill="#1e120c" />
      <path d="M18 28v-8a6 6 0 0 1 12 0v8" fill="none" stroke="#1e120c" strokeWidth="2.8" strokeLinecap="round" />
      <path
        transform="translate(12.5 14) scale(5.6)"
        d="M0,-1L.265,-.364L.951,-.309L.428,.139L.588,.809L0,.45L-.588,.809L-.428,.139L-.951,-.309L-.265,-.364Z"
        fill="#ffe14d"
        stroke="#1e120c"
        strokeWidth="0.3"
        strokeLinejoin="round"
      />
      <path transform="translate(38.5 7.5) scale(0.46)" d={CAMINHO_CORACAO} fill="#ff3d6e" stroke="#1e120c" strokeWidth="3.6" strokeLinejoin="round" />
    </svg>
  );
}
