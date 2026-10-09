// Memória do assistente: o mesmo fato escrito de outro jeito (maiúsculas, acento, pontuação) conta como repetido
const norm = (x: string) => x.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export const sameFact = (a: string, b: string) => norm(a) === norm(b);
