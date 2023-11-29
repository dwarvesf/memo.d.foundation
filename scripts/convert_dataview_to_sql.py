from pyparsing import *

# Define punctuation and keywords
semicolon = Combine(Literal(';') + lineEnd)
comma = Literal(',')
lparen = Literal('(')
rparen = Literal(')')
lbracket = Literal('[')
rbracket = Literal(']')

keywords = ['LIST', 'TASK', 'FROM', 'TABLE', 'WHERE', 'AND', 'FLATTEN', 'LIMIT', 'CHOICE', 'NOT', 'AS', 'OR']
keyword_objects = map(lambda x: Keyword(x, caseless=True), keywords)
list_kw = Keyword('LIST', caseless=True)
task_kw = Keyword('TASK', caseless=True)
table_kw = Keyword('TABLE', caseless=True)
from_kw = Keyword('FROM', caseless=True)
and_kw = Keyword('AND', caseless=True)
not_kw = Keyword('NOT', caseless=True)
or_kw = Keyword('OR', caseless=True)
as_kw = Keyword('AS', caseless=True)

reserved_words = Or(keyword_objects)

# Define identifiers and tables
common_word = Word(alphas + '-_#.()/', alphanums + '-_#.()/')
wikilink = Combine(Optional(lparen) + lbracket + lbracket + delimitedList(Word(alphas + "-_#.()/ ", alphanums + "-_#.()/ "), delim=" ") + rbracket + rbracket + Optional(rparen))

ident = ~reserved_words + (common_word + Optional(wikilink) | dblQuotedString.setParseAction(removeQuotes) | sglQuotedString.setParseAction(removeQuotes))
table = Forward()
table_delim = and_kw | rparen + or_kw + lparen | or_kw
table_list = delimitedList(table, delim=table_delim)

simple_table = Combine(Optional(Literal('!')) + ident)
nested_table = lparen.suppress() + table_list + rparen.suppress()

table << (nested_table | simple_table)

# Define columns
column_delim = as_kw + ident + comma | comma
column_list = delimitedList(ident, delim=column_delim)

# Define clauses
from_clause = from_kw.suppress() + table_list
table_clause = (list_kw.suppress() | table_kw.suppress() | task_kw.suppress()) + column_list

# Test the parser
txt = 'FROM #status/open OR #status/wip'
for token, start, end in table_clause.scanString(txt):
  print("Columns:", token.asList())
for token, start, end in from_clause.scanString(txt):
  print("Tables:", token.asList())
