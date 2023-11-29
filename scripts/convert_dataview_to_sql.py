from pyparsing import *
import json

# Define punctuation and keywords
semicolon = Combine(Literal(';') + lineEnd)
comma = Literal(',')
lparen = Literal('(')
rparen = Literal(')')
lbracket = Literal('[')
rbracket = Literal(']')

keywords = ['LIST', 'TASK', 'FROM', 'TABLE', 'WHERE', 'AND', 'FLATTEN', 'LIMIT', 'CHOICE', 'NOT', 'AS', 'OR', 'WITHOUT ID']
keyword_objects = map(lambda x: Keyword(x, caseless=True), keywords)
list_kw = Keyword('LIST', caseless=True)
task_kw = Keyword('TASK', caseless=True)
table_kw = Keyword('TABLE', caseless=True)
from_kw = Keyword('FROM', caseless=True)

and_kw = Keyword('AND', caseless=True)
not_kw = Keyword('NOT', caseless=True)
or_kw = Keyword('OR', caseless=True)
as_kw = Keyword('AS', caseless=True)

where_kw = Keyword('WHERE', caseless=True)
sort_kw = Keyword('SORT', caseless=True)
limit_kw = Keyword('LIMIT', caseless=True)
group_kw = Keyword('GROUP BY', caseless=True)

asc_kw = Keyword('ASC', caseless=True)
desc_kw = Keyword('DESC', caseless=True)

reserved_words = Or(keyword_objects)

# Define identifiers and tables
common_word = Word(alphas + '-_#.()/', alphanums + '-_#.()/')
wikilink = Combine(Optional(lparen) + lbracket + lbracket + delimitedList(Word(alphas + "-_#.()/ ", alphanums + "-_#.()/ "), delim=" ") + rbracket + rbracket + Optional(rparen))

ident = ~reserved_words + (common_word + Optional(wikilink) | quotedString)
table = Forward()
nested_delim = and_kw | rparen + or_kw + lparen | or_kw
table_list = delimitedList(table, delim=nested_delim)

simple_table = Combine(Optional(Literal('!')) + ident)
nested_table = lparen.suppress() + table_list + rparen.suppress()

table << (nested_table | simple_table)

# Define columns
column_delim = as_kw + ident + comma | comma
column_list = delimitedList(ident, delim=column_delim)

# Define clauses
from_clause = from_kw.suppress() + table_list
column_clause = (list_kw.suppress() | table_kw.suppress() | task_kw.suppress()) + column_list
where_clause = where_kw.suppress() + delimitedList(ident, delim=nested_delim)
sort_clause = sort_kw.suppress() + delimitedList(ident, delim=comma) + (asc_kw | desc_kw)
limit_clause = limit_kw.suppress() + Word(nums)
group_clause = group_kw.suppress() + delimitedList(ident, delim=comma)

clauses = {
	"from": from_clause,
	"select": column_clause,
	"where": where_clause,
	"sort": sort_clause,
	"limit": limit_clause,
	"groupBy": group_clause,
}

# Test the parser
txt = '''
TABLE feat
FROM earn
WHERE !completed
SORT created ASC
LIMIT 10
GROUP BY file.link
SORT rows.file.ctime ASC
'''

query_dict = {key: [] for key in clauses.keys()}

for key, clause in clauses.items():
	for token, start, end in clause.scanString(txt):
		query_dict[key].append(token.asList())

print(json.dumps(query_dict, indent=2))