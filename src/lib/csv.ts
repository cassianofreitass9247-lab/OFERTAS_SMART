/** Leitor de CSV sem dependências: aspas, quebras de linha dentro de aspas, ";" "," ou TAB. */

export function detectarSeparador(texto: string): string {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? "";
  let melhor = ";";
  let max = -1;
  for (const sep of [";", ",", "\t"]) {
    const qtd = primeira.split(sep).length - 1;
    if (qtd > max) {
      max = qtd;
      melhor = sep;
    }
  }
  return melhor;
}

export function lerCsv(textoBruto: string): string[][] {
  const texto = textoBruto.replace(/^﻿/, "");
  const sep = detectarSeparador(texto);
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let emAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (emAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else emAspas = false;
      } else campo += c;
    } else if (c === '"' && campo === "") {
      emAspas = true;
    } else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((v) => v.trim() !== ""));
}

/** Arquivos do Excel no Brasil costumam vir em Windows-1252; tenta UTF-8 primeiro. */
export function decodificarArquivo(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
