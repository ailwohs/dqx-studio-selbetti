
from pyspark.sql import DataFrame
from pyspark.sql import functions as F


def calcular_frequencias(
    df: DataFrame,
    coluna: str,
    limite: int = 5,
) -> list[dict]:
    """Retorna os valores mais frequentes de uma coluna."""

    frequencias = (
        df.groupBy(F.col(coluna))
        .count()
        .orderBy(F.desc("count"))
        .limit(limite)
        .collect()
    )

    return [
        {
            "valor": str(linha[0]) if linha[0] is not None else None,
            "quantidade": int(linha[1]),
        }
        for linha in frequencias
    ]
