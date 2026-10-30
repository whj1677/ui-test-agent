// A literal source check, never a natural-language entailment or business verdict.
// Keep negation, conditions, object names and values. Do not match fragments inside a sentence.
// Line wrapping is formatting; semicolons join clauses that may share a condition or negation.
const sentences = text => String(text).replace(/\s+/gu, ' ').split(/[。！？!?]+/u).map(part => part.trim()).filter(Boolean);
const contiguous = (wanted, available) => wanted.length > 0 && available.some((_, start) =>
  wanted.every((sentence, offset) => available[start + offset] === sentence));

export function sourceTextSupport(text, evidence) {
  const wanted = sentences(text);
  const references = evidence.filter(item => contiguous(wanted, sentences(item.text)) &&
    (!item.quote || contiguous(wanted, sentences(item.quote)))).map(item => item.reference_index);
  return { status: references.length ? 'DIRECT_QUOTE' : 'UNVERIFIED', reference_indexes: references };
}
