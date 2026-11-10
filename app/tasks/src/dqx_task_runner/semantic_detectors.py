
"""Detectores semÃ¢nticos personalizados da Selbetti para o DQX."""

import re

from databricks.labs.dqx.profiler.semantic import (
    DQSemanticType,
    DQSemanticTypeDetector,
    SemanticRegistry,
)


CPF_PATTERN = re.compile(
    r"(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})"
)


def possui_formato_cpf(valor: str | None) -> bool:
    if valor is None:
        return False

    return bool(CPF_PATTERN.fullmatch(str(valor).strip()))



def detectar_cpf(ctx):
    """Identifica CPF pelo conteÃºdo ou pelo nome da coluna."""

    nome = ctx.column_name.upper()
    # Evita confundir telefones de 11 dÃ­gitos com CPF.
    if any(termo in nome for termo in ("TELEFONE", "CELULAR", "WHATSAPP", "FONE")):
         return None

    # Evita executar consultas adicionais em colunas
    # que nÃ£o sÃ£o textuais.
    from pyspark.sql.types import StringType

    if not isinstance(ctx.column_type, StringType):
        if "CPF" in nome:
            return DQSemanticType(
                name="cpf",
                description="PossÃ­vel CPF identificado pelo nome da coluna",
            )
        return None

    from pyspark.sql import functions as F

    # Limite de registros examinados pelo detector.
    limite = 1000

    # Aceita CPF com ou sem pontuaÃ§Ã£o.
    padrao = r"^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$"

    coluna = F.trim(F.col(ctx.column_name).cast("string"))

    # Executa a verificaÃ§Ã£o dentro do Spark.
    # Retorna somente contagens, nÃ£o valores individuais.
    resultado = (
        ctx.df
        .limit(limite)
        .select(
            F.when(coluna.rlike(padrao), 1)
            .otherwise(0)
            .alias("formato_cpf")
        )
        .agg(
            F.count("*").alias("total"),
            F.sum("formato_cpf").alias("validos")
        )
        .first()
    )

    total = resultado["total"] or 0
    validos = resultado["validos"] or 0

    proporcao = validos / total if total else 0

    if total > 0 and proporcao >= 0.90:
        return DQSemanticType(
            name="cpf",
            description="CPF brasileiro identificado pelo formato dos valores",
        )

    # IdentificaÃ§Ã£o provisÃ³ria pelo nome.
    if "CPF" in nome:
        return DQSemanticType(
            name="cpf",
            description="PossÃ­vel CPF identificado pelo nome da coluna",
        )

    return None

def detectar_telefone(ctx):
    """Identifica colunas de telefone pelo nome."""

    nome = ctx.column_name.upper()

    termos_telefone = (
        "TELEFONE",
        "CELULAR",
        "WHATSAPP",
        "FONE",
    )

    if any(termo in nome for termo in termos_telefone):
        return DQSemanticType(
            name="telefone",
            description="Telefone brasileiro identificado pelo nome da coluna",
        )

    return None

def criar_registro_semantico() -> SemanticRegistry:
    detector_cpf = DQSemanticTypeDetector(
        name="cpf",
        detect=detectar_cpf,
    )

    detector_telefone = DQSemanticTypeDetector(
        name="telefone",
        detect=detectar_telefone,
    )

    return (
        SemanticRegistry.default()
        .prepend(detector_cpf)
        .prepend(detector_telefone)
    )
