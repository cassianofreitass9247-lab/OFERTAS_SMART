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

/** Bytes 0x80–0xFF da página de código CP850 (DOS/OEM), usada por "CSV (MS-DOS)" e alguns conversores. */
const CP850_ALTO = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´\xad±‗¾¶§÷¸°¨·¹³²■\xa0';

const LETRAS_PT = new Set("áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ");

function decodificarCp850(bytes: Uint8Array): string {
  let r = "";
  for (const b of bytes) r += b < 0x80 ? String.fromCharCode(b) : CP850_ALTO[b - 0x80];
  return r;
}

function pontuarAcentos(texto: string): number {
  let n = 0;
  for (const c of texto) if (LETRAS_PT.has(c)) n++;
  return n;
}

/**
 * Tenta UTF-8 primeiro. Se não for, o arquivo é de página de código antiga: decide entre Windows-1252
 * (padrão do Excel no Brasil) e CP850 pelo número de letras acentuadas do português que cada leitura produz.
 * Em empate, vale Windows-1252.
 */
export function decodificarArquivo(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    const w1252 = new TextDecoder("windows-1252").decode(bytes);
    const cp850 = decodificarCp850(new Uint8Array(bytes));
    return pontuarAcentos(cp850) > pontuarAcentos(w1252) ? cp850 : w1252;
  }
}
