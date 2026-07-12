# forecast-calibration-kit

Biblioteca TypeScript (+ CLI) de metricas de calibracao de previsoes probabilisticas binarias.
Projeto open source (MIT), portfolio publico. Repo: `donizetiferr/forecast-calibration-kit` (privado ate revisao).

> Este arquivo e contexto interno de desenvolvimento — NAO vai para o GitHub (excluido via `.git/info/exclude`).

## OBJETIVOS

### Preencher a lacuna JS/TS de metricas de calibracao

Python tem scikit-learn/briertools; o ecossistema JS/TS nao tinha um pacote dedicado.
Entregar Brier score, log loss, curva de calibracao (reliability diagram), ECE e a
decomposicao de Murphy do Brier score (reliability - resolution + uncertainty).

### Qualidade de biblioteca de mercado

TypeScript strict sem `any`; zero dependencias de runtime; validacao nas fronteiras;
testes com casos matematicos conhecidos + identidade de Murphy; cobertura alta no core;
build dual ESM+CJS com tipos; CI verde; CLI utilizavel.

## ESTRUTURA

- `src/metrics/` — uma metrica por arquivo (`_binning.ts` e helper interno de binning compartilhado).
- `src/validation.ts` — `CalibrationError` + asserts de fronteira (`assertSamples`, `assertBins`, `assertEps`).
- `src/cli.ts` — logica pura da CLI (parse/compute/format/run, com I/O injetada).
- `src/bin.ts` — bootstrap do binario (`dist/cli.js`), liga I/O real do processo.
- `src/index.ts` — API publica.
- `test/` — Vitest (um arquivo por modulo).

## REGRAS

- A identidade `Brier = reliability - resolution + uncertainty` e exata quando os forecasts
  sao constantes dentro de cada bin; aproximada caso contrario (variancia intra-bin). Testes
  de identidade usam datasets constante-por-bin (`p` = midpoint) para exatidao a tolerancia float.
- Nenhuma mencao a IA/assistentes em arquivos versionados (politica de privacidade).
- `npm run lint && npm run typecheck && npm test && npm run build` deve passar antes de qualquer commit.
