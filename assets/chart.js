const API = 'https://w3qa5ydb4l.execute-api.eu-west-1.amazonaws.com/prod/finnishCoronaData';
var apiResponse = '';

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
      const remappedData = _.chain(apiResponse.confirmed)
        .groupBy('healthCareDistrict')
        .map((value, key) => ({
          healthCareDistrict: key,
          cases: value,
          region: _.find(regionMap, ['healthCareDistrict', key])
        }))
        .value();

      let tr = '';
      remappedData.forEach(data => {
        tr += `<tr>
          <td>${data.cases.length}</td>
          <td>${data.healthCareDistrict}</td>
        </tr>`;
      });
      $('#dataTableBody').append(tr);

      // var title = 'Coronavirus disease (COVID-19) outbreak in Finland';
      // Create map instance
      var chart = am4core.create('chartdiv', am4maps.MapChart);
      // chart.titles.create().text = title;
      chart.tapToActivate = true;

      // Set map definition
      chart.geodataSource.url = 'assets/finlandLow.json';
      chart.geodataSource.events.on('parseended', function(ev) {
        var data = [];

        for(var i = 0; i < ev.target.data.features.length; i++) {
          const id = ev.target.data.features[i].id;

          let count = 0;
          if (_.find(remappedData, { region: {id: id}})) {
            const rx = _.find(remappedData, { region: {id: id}});
            count = rx.cases.length;
          }
          data.push({
            id: ev.target.data.features[i].id,
            value: count
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

      // Create hover state and set alternative fill color
      var hs = polygonTemplate.states.create('hover');
      hs.properties.fill = chart.colors.getIndex(1).brighten(-0.5);
    });
  }); // end am4core.ready()
});
