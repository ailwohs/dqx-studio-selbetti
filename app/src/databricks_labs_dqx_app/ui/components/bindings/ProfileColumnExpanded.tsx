
import { useTranslation } from "react-i18next";
import { fmtStat, typeGroup, type StatTypeGroup } from "@/lib/profile-format";

interface Props {
  stats: Record<string, unknown>;
  sparkType: string | undefined;
}

/**
 * DQX profiler summary_json:
 * count, count_null, count_non_null, count_distinct,
 * empty_count, mean, stddev, min, max,
 * "25%", "50%", "75%".
 *
 * Extensao Selbetti:
 * top_values: [{ valor: string | null, quantidade: number }]
 */

interface TopValue {
  valor: string | null;
  quantidade: number;
}

const PERCENTILE_KEYS = new Set(["25%", "50%", "75%"]);

const HIDDEN_KEYS = new Set([
  "count_non_null",
  "count_distinct",
  "count",
  "top_values",
  "semantic_type",
]);

function orderKeys(
  group: StatTypeGroup,
  present: string[],
): string[] {
  const base: string[] =
    group === "numeric"
      ? ["count_null", "empty_count", "min", "max", "mean", "stddev"]
      : group === "string"
        ? [
          "count_null",
          "empty_count",
          "min",
          "max",
          "min_length",
          "max_length",
          "avg_length",
        ]
        : group === "timestamp"
          ? ["count_null", "empty_count", "min", "max"]
          : ["count_null", "empty_count", "min", "max"];

  const ordered = base.filter((key) => present.includes(key));

  const extras = present
    .filter(
      (key) =>
        !base.includes(key) &&
        !PERCENTILE_KEYS.has(key),
    )
    .sort();

  return [...ordered, ...extras];
}

function isTopValue(item: unknown): item is TopValue {
  if (
    typeof item !== "object" ||
    item === null ||
    !("valor" in item) ||
    !("quantidade" in item)
  ) {
    return false;
  }

  return (
    (typeof item.valor === "string" || item.valor === null) &&
    typeof item.quantidade === "number" &&
    Number.isFinite(item.quantidade) &&
    item.quantidade >= 0
  );
}

export function ProfileColumnExpanded({
  stats,
  sparkType,
}: Props) {
  const { t } = useTranslation();

  const group = typeGroup(sparkType);
  const semanticType = String(stats.semantic_type ?? "").trim().toLowerCase();
  const isCpf = semanticType === "cpf";
  const isTelefone = semanticType === "telefone";
  const isDadoPessoal = isCpf || isTelefone;

  const presentKeys = Object.keys(stats).filter(
    (key) =>
      !HIDDEN_KEYS.has(key) &&
      stats[key] != null,
  );

  const ordered = orderKeys(group, presentKeys);

  // Valores mais frequentes retornados pelo Task Runner.
  const topValues: TopValue[] = Array.isArray(stats.top_values)
    ? stats.top_values.filter(isTopValue).slice(0, 5)
    : [];

  const maxFrequency = Math.max(
    1,
    ...topValues.map((item) => item.quantidade),
  );

  const LABELS: Record<string, string> = {
    count_null: t("monitoredTables.profileStatCountNull"),
    count_non_null: t("monitoredTables.profileStatCountNonNull"),
    count_distinct: t("monitoredTables.profileStatCountDistinct"),
    empty_count: t("monitoredTables.profileStatEmptyCount"),
    min: t("monitoredTables.profileStatMin"),
    max: t("monitoredTables.profileStatMax"),
    mean: t("monitoredTables.profileStatMean"),
    stddev: t("monitoredTables.profileStatStddev"),
    "25%": t("monitoredTables.profileStatP25"),
    "50%": t("monitoredTables.profileStatMedian"),
    "75%": t("monitoredTables.profileStatP75"),
    max_length: t("monitoredTables.profileStatMaxLength"),
    min_length: t("monitoredTables.profileStatMinLength"),
    avg_length: t("monitoredTables.profileStatAvgLength"),
  };

  const showPercentiles =
    group === "numeric" &&
    Array.from(PERCENTILE_KEYS).some(
      (key) => stats[key] != null,
    );

  return (
    <div className="px-4 pt-3 pb-4 pl-12">
      {isDadoPessoal && (
        <div className="mb-4 rounded-lg border border-green-600/40 bg-green-600/10 p-3">
          <div className="text-xs font-semibold text-green-500">
            Classificação semântica
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded bg-green-600/20 px-2 py-1 text-xs">
              {isCpf ? "CPF brasileiro" : "Telefone brasileiro"}
            </span>

            <span className="rounded bg-green-600/20 px-2 py-1 text-xs">
              Dado pessoal
            </span>
          </div>
        </div>
      )}
      {/* Estatisticas originais do DQX */}
      <h5 className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
        {t("monitoredTables.profileStatisticsHeading")}
      </h5>

      <div className="grid grid-cols-4 gap-x-5 gap-y-2">
        {ordered.map((key) => (
          <div key={key}>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {LABELS[key] ?? key}
            </div>

            <div className="font-mono text-xs break-all">
              {fmtStat(stats[key])}
            </div>
          </div>
        ))}

        {showPercentiles && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("monitoredTables.profileStatPercentiles")}
            </div>

            <div className="font-mono text-xs">
              {fmtStat(stats["25%"])} /{" "}
              {fmtStat(stats["50%"])} /{" "}
              {fmtStat(stats["75%"])}
            </div>
          </div>
        )}
      </div>

      {/* Extensao Selbetti: valores mais frequentes */}
      {topValues.length > 0 && (
        <div className="mt-5 border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-xs font-semibold">
              Valores mais frequentes
            </h5>

            <span className="text-[10px] text-muted-foreground">
              Top {topValues.length}
            </span>
          </div>

          <div className="space-y-3">
            {topValues.map((item, index) => {
              const percentage =
                (item.quantidade / maxFrequency) * 100;

              return (
                <div
                  key={`${item.valor ?? "null"}-${index}`}
                  className="space-y-1"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="text-xs font-medium truncate"
                      title={isDadoPessoal ? (item.valor === null ? "Nulo" : "Valor protegido") : (item.valor ?? "Nulo")}
                    >
                      {isDadoPessoal ? (item.valor === null ? "Nulo" : "Valor protegido") : (item.valor ?? "Nulo")}
                    </span>

                    <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {item.quantidade.toLocaleString("pt-BR")}
                    </span>
                  </div>

                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{
                        width: `${percentage}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-[10px] text-muted-foreground">
            Frequencias calculadas sobre os registros
            utilizados no perfilamento. Barras relativas
            ao valor mais frequente.
          </p>
        </div>
      )}
    </div>
  );
}
