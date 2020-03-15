const API = 'https://w3qa5ydb4l.execute-api.eu-west-1.amazonaws.com/prod/finnishCoronaData';
var apiResponse = '';

var yellow = '#ffc107';
var green = '#28a745';
var red = '#dc3545';

function timestampToDate(timestamp) {
  return moment(timestamp).format('YYYY-MM-DD');
}

$.get(API, function(data) {
  apiResponse = data;
  $('#totalConfirmed').append(apiResponse.confirmed.length);
  $('#totalRecovered').append(apiResponse.recovered.length);
  $('#totalDeaths').append(apiResponse.deaths.length);
}).done(function() {
  am4core.ready(function() {
    var regionMap = {};

    $.getJSON('assets/fi.json', function(data) {
      regionMap = data;
    }).done(function() {
      am4core.useTheme(am4themes_animated);

      apiResponse.confirmed.forEach(item => {
        item.day = timestampToDate(item.date);
      });
      apiResponse.recovered.forEach(item => {
        item.day = timestampToDate(item.date);
      });

      const groupedByHealthCareDistrict = _.chain(apiResponse.confirmed)
        .groupBy('healthCareDistrict')
        .map((value, key) => ({
          healthCareDistrict: key,
          infectedCases: value,
          region: _.find(regionMap, ['healthCareDistrict', key])
        }))
        .value();

      const infectedGroupedByDate = _.chain(apiResponse.confirmed)
        .groupBy('day')
        .map((value, key) => ({
          date: key,
          infectedCases: value,
        }))
        .value();

      infectedGroupedByDate.forEach(item => {
        item.infectedTotal = item.infectedCases.length;
      });

      let recoveredGroupedByDate = _.chain(apiResponse.recovered)
        .groupBy('day')
        .map((value, key) => ({
          date: key,
          recoveredCases: value,
        }))
        .value();

      recoveredGroupedByDate.forEach(item => {
        item.recoveredTotal = item.recoveredCases.length;
      });

      let allGroupsByDate = _(recoveredGroupedByDate)
          .concat(infectedGroupedByDate)
          .groupBy('date')
          .map(_.spread(_.merge))
          .value();

      allGroupsByDate = _.sortBy(allGroupsByDate, ['date']);

      infectedGroupedByDate.forEach(item => {
        item.total = item.infectedCases.length;
        // item[element.healthCareDistrict] = 1;

        const caseItem = _.chain(item.infectedCases)
        .groupBy('healthCareDistrict')
        .map((value, key) => ({
          healthCareDistrict: key,
          infectedCases: value,
          region: _.find(regionMap, ['healthCareDistrict', key])
        }))
        .value();

        caseItem.forEach(elem => {
          item[elem.healthCareDistrict] = elem.infectedCases.length;
        });
      });

      let tr = '';
      groupedByHealthCareDistrict.forEach(item => {
        tr += `<tr>
          <td>${item.infectedCases.length}</td>
          <td>${item.healthCareDistrict}</td>
        </tr>`;
      });
      $('#dataTableBody').append(tr);

      // var title = 'Coronavirus disease (COVID-19) outbreak in Finland';
      // Create map instance
      var chart = am4core.create('mapDiv', am4maps.MapChart);
      // chart.titles.create().text = title;
      chart.tapToActivate = true;

      // Set map definition
      chart.geodataSource.url = 'assets/finlandLow.json';
      chart.geodataSource.events.on('parseended', function(ev) {
        var data = [];

        for(var i = 0; i < ev.target.data.features.length; i++) {
          const id = ev.target.data.features[i].id;

          let count = 0;
          selected = true;

          if (_.find(groupedByHealthCareDistrict, { region: {id: id}})) {
            const rx = _.find(groupedByHealthCareDistrict, { region: {id: id}});
            count = rx.infectedCases.length;
            selected = false;
          }
          data.push({
            id: ev.target.data.features[i].id,
            value: count,
            selected: selected
          });
        }

        polygonSeries.data = data;
      })

      // Set projection
      chart.projection = new am4maps.projections.Mercator();

      // Create map polygon series
      var polygonSeries = chart.series.push(new am4maps.MapPolygonSeries());

      //Set min/max fill color for each area
      polygonSeries.heatRules.push({
        property: 'fill',
        target: polygonSeries.mapPolygons.template,
        min: chart.colors.getIndex(1).brighten(1),
        max: chart.colors.getIndex(1).brighten(-0.9)
      });

      // Make map load polygon data (state shapes and names) from GeoJSON
      polygonSeries.useGeodata = true;

      // Set up heat legend
      let heatLegend = chart.createChild(am4maps.HeatLegend);
      heatLegend.series = polygonSeries;
      heatLegend.align = 'right';
      heatLegend.width = am4core.percent(25);
      heatLegend.marginRight = am4core.percent(4);
      heatLegend.minValue = 0;
      heatLegend.maxValue = 40000000;
      heatLegend.valign = 'bottom';

      // Set up custom heat map legend labels using axis ranges
      var minRange = heatLegend.valueAxis.axisRanges.create();
      minRange.value = heatLegend.minValue;
      minRange.label.text = 'Low';
      var maxRange = heatLegend.valueAxis.axisRanges.create();
      maxRange.value = heatLegend.maxValue;
      maxRange.label.text = 'High';

      // Blank out internal heat legend value axis labels
      heatLegend.valueAxis.renderer.labels.template.adapter.add('text', function(labelText) {
        return '';
      });

      // Configure series tooltip
      var polygonTemplate = polygonSeries.mapPolygons.template;
      polygonTemplate.tooltipText = '{name}: {value}';
      polygonTemplate.nonScalingStroke = true;
      polygonTemplate.strokeWidth = 0.5;

      polygonTemplate.adapter.add('fill', function(fill, target) {
        if (target.dataItem.dataContext && target.dataItem.dataContext.selected) {
          return am4core.color('#28a745');
        }
        return fill;
      });

      // Create hover state and set alternative fill color
      var hs = polygonTemplate.states.create('hover');
      hs.properties.fill = chart.colors.getIndex(1).brighten(-0.5);

      createStackedBarChart('hcdStackedBarChart', infectedGroupedByDate);
      createStackedBarChart('allGroupsStackedBarChart', allGroupsByDate);
    });


    function createStackedBarChart(id, data) {
      const stackedBarChart = am4core.create(id, am4charts.XYChart);
      stackedBarChart.data = data;

      // Create axes
      var categoryAxis = stackedBarChart.xAxes.push(new am4charts.CategoryAxis());
      categoryAxis.dataFields.category = 'date';
      categoryAxis.title.text = 'Date';
      categoryAxis.renderer.grid.template.location = 0;
      // categoryAxis.renderer.grid.template.strokeOpacity = 0.25;
      categoryAxis.renderer.minGridDistance = 20;
      categoryAxis.renderer.cellStartLocation = 0.1;
      categoryAxis.renderer.cellEndLocation = 0.9;
      categoryAxis.renderer.labels.template.horizontalCenter = 'right';
      categoryAxis.renderer.labels.template.verticalCenter = 'middle';
      categoryAxis.renderer.labels.template.rotation = 90;

      var valueAxis = stackedBarChart.yAxes.push(new am4charts.ValueAxis());
      valueAxis.min = 0;

      // Create series
      function createSeries(field, name, stacked, color) {
        var series = stackedBarChart.series.push(new am4charts.ColumnSeries());
        series.dataFields.valueY = field;
        series.dataFields.categoryX = 'date';
        series.name = name;
        series.columns.template.tooltipText = '{name}: [bold]{valueY}[/]';
        series.stacked = stacked;
        series.columns.template.width = am4core.percent(95);
        series.strokeWidth = 0;

        if (color) {
          series.fill = am4core.color(color);
        }
      }


      switch (id) {
        case 'allGroupsStackedBarChart':
          valueAxis.title.text = 'Number of cases';

          createSeries('infectedTotal', 'Infected', false, yellow);
          createSeries('recoveredTotal', 'Recovered', false, green);
          createSeries('deathsTotal', 'Deaths', false, red);
          break;

        case 'hcdStackedBarChart':
          valueAxis.title.text = 'Confirmed number of infections';

          regionMap.forEach(element => {
              const hcd = element.healthCareDistrict;
              createSeries(hcd, hcd, true);
            });
          break;
        default:
          break;
      }

      // Add legend
      stackedBarChart.legend = new am4charts.Legend();
    }
  }); // end am4core.ready()
});
