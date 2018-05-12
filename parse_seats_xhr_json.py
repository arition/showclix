import json

# File downloaded from https://api.seats.io/system/public/6ee8c1fa-4bac-4ed0-89aa-26b6228f06fa/chart-and-rendering-info?event_key=4725977
input_file = "chart-and-rendering-info.json"

input_f = open(input_file, 'r')
data = json.loads(input_f.read())
input_f.close()

chart = data['chart']
name = chart['name']
uuidCounter = chart['uuidCounter']
tablesLabelCounter = chart['tablesLabelCounter']
categories = chart['categories']
subChart = chart['subChart']
rows = subChart['rows']
cat_set = set()
cat_list = [u'ORCHESTRA', u'MEZZANINE', u'ADA ORCHESTRA', u'ADA MEZZANINE', u'VIP', u'LOGE', u'ADA VIP', u'ADA LOGE']

cat2row2seats = {cat: {} for cat in cat_list}
uuid2row = dict()
uuid2column = dict()
count = 0
for row_num, row in enumerate(rows):
    row_uuid = row['uuid']
    row_label = row['label']
    seatLabeling = row['seatLabeling']
    seats = row['seats'] # lists
    objectType = row['objectType'] # row
    for seat_num, seat in enumerate(seats):
        categoryLabel = seat['categoryLabel']
        if categoryLabel != u'ORCHESTRA':
            continue
        count += 1
        seat_uuid = seat['uuid']
        seat_label = seat['label']
        if row_label not in cat2row2seats[categoryLabel]:
            cat2row2seats[categoryLabel][row_label] = list()
        cat2row2seats[categoryLabel][row_label].append({seat_label: seat_uuid})
        uuid2row[seat_uuid] = row_label
        uuid2column[seat_uuid] = seat_label
    #if count > 10:
        #break

results = {
        'uuid2row': uuid2row,
        'uuid2column': uuid2column,
        'cat2row2seats': cat2row2seats
        }

with open('seats.json', 'wb') as output_f:
    output_f.write(json.dumps(results))

with open('seats.js', 'wb') as output_f:
    output_f.write('var cat2row2seats = ')
    output_f.write(str(cat2row2seats).replace("u'", "'"))
    output_f.write(';')
