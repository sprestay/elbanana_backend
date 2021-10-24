const { candidate } = require("./test_data_folders/test_user");

const languageLevelConvert = {
    "Beginner (A2)": 1,
    "Intermediate (B1)": 2,
    "Work Proficient (B2)": 3,
    "Fluent (C1)": 4,
    "Native or Bilingual": 5,
}


const toNormalArray = (item) => {
    if (item['arrayValue'] && item['arrayValue']['values'])
        return item['arrayValue']['values']
    else
        return item;
}

const intersect = (a, b) => {
    return a.filter((i) => b.includes(i));
}

const experienceListToRange = (exp) => {
    if (exp == undefined)
        return [0,0];
    let min = 20;
    let max = 0;
    let x1 = parseInt(exp.split('-')[0]);
    let x2 = parseInt(exp.split('-')[1]);
    if (isNaN(x2)) // костыль exp=6+
        return [x1, x1];
    min = Math.min(x1, x2, min);
    max = Math.max(x1, x2, max);
    return [min, max];
}

const languageComparasion = (filter, candidate) => {
    for (let lang of filter) {
        if (!lang['Language']) // выходим - языки не выбранны
            return true;
        let l = lang['Language'][0];
        let c_l = candidate.filter((i) => i["Language"] == l);
        if (c_l) {
            c_l = c_l[0];
            if (languageLevelConvert[c_l['LanguageLevel']] >= languageLevelConvert[lang["Language"]])
                return true;
        }
    }
    return false;
}

const ListToBool = (a) => {
    if (Boolean(a) && a.length > 0)
        return true;
    else
        return false;
}

const meanTime = (a) => {
    return a.reduce((b, c) => b + c) / a.length;
}

const RolesComparasion = (f, c) => {
    if (!ListToBool(f["Roles"]) || !ListToBool(f["Roles"][0]["CandidateRoleList"]))
        return true;
    
    if (ListToBool(f['Roles']) && !ListToBool(c["PreferedRole"]))
        return false;
    var filter_roles = {};
    f["Roles"].map((item) => {
        if (!ListToBool(item['CandidateRoleList']))
            return
        for (let i = 0; i < item['CandidateRoleList'].length; i++) {
            for (let j = 0; j < item['CandidateRoleList'][i]['Category'].length; j++) {
                filter_roles[`${item['CandidateRoleList'][i]['Name']} | ${item['CandidateRoleList'][i]['Category'][j]}`] = item['Experience'] ? meanTime(experienceListToRange(item["Experience"])) : 0;
            }
        }
    });

    var candidate_roles = {};
    c["PreferedRole"].map((item) => {
        if (!ListToBool(item["Role"]))
            return;
        for (let i = 0; i < item["Role"].length; i++) {
            for (let j = 0; j < item['Role'][j]['Category']; j++) {
                candidate_roles[`${item["Role"][i]["Name"]} | ${item["Role"][i]["Category"][j]}`] = item['ExperienceSelection'] ? meanTime(experienceListToRange(item["ExperienceSelection"])) : 0;
            }
        }
    });
    
    if (Object.keys(filter_roles).length == 0)
        return true;
    Object.keys(filter_roles).forEach((item) => {
        if (candidate_roles[item] && filter_roles[item] <= candidate_roles[item])
            return true;
    });
    return false
}
// переписать - ужасно
const TechTagParser = (item, experience_name) => {
    if (item["TechTag"] == undefined)
        return undefined;

    for (let j = 0; j < item["TechTag"].length; j++) {
        return [[item["TechTag"][j]["Name"]], item[experience_name] ? meanTime(experienceListToRange(item[experience_name])) : 0];
    }
}

const TechListComparasion = (f, c) => {
    if (!ListToBool(f["TechList"]))
        return true;
    if (ListToBool(f["TechList"]) && !ListToBool(c['PreferedTech']))
        return false;

    var filters = {};
    f["TechList"].map((item) => {
        var x = TechTagParser(item, "Experience");
        if (x != undefined)
            filters[x[0]] = x[1];
    });
    var candidate = {};
    c["PreferedTech"].map((item) => {
        var x = TechTagParser(item, "ExperienceSelection");
        if (x != undefined)
            candidate[x[0]] = x[1];
    });

    var keys = Object.keys(filters);
    for (let i = 0; i < keys.length; i++) {
        if (candidate[keys[i]] != undefined && filters[keys[i]] <= candidate[keys[i]]) {
            return true;
        }
    };
    return false;
}


// сравнение локаций
const PreferedLocationComparasion = (f, c) => {
    if (f['JobLocation'] == undefined) // рекрутер не заполнял данный фильтр //On-site / Remote ...
        return true;

    if (!ListToBool(c["PreferedLocation"])) // загулшка. Незаполненных быть не должно
        return false;

    var results = c["PreferedLocation"].filter((i) => StatusChecker2(f, i, c));
    if (results.length != 0)
        return true;
    else
        return false;
}

const TimeZoneToInt = (timezone) => {
    // GMT−09:00
    var t = parseInt(timezone.slice(3,).split(":")[0]);
    return t;
}

const deg2rad = (deg) => {
    return deg * (Math.PI/180)
}

const getDistanceFromLatLonInKm = (lat1,lon1,lat2,lon2) => {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLon = deg2rad(lon2-lon1); 
    var a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
      ; 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c; // Distance in km
    return d;
}

const extractDistanceFromSearch = (str) => {
    if (str == undefined)
        return undefined;
    //Within 200km
    return parseInt(str.split(" ")[1]);
}

// фильтр - список стран, из которых принимаем. RelocationCountries
// фильтр - флаги - withinCountry, WW, EU, Asia, US
// фильр - WorkPermitFromMyCountry

// кандидат -
const CompareAdresses = (addr1, addr2, radius=100) => {
    a1_lat = addr1['lat'];
    a1_lng = addr1['lng'];
    a2_lat = addr2['lat'];
    a2_lng = addr2['lng'];
    var dist = getDistanceFromLatLonInKm(a1_lat, a1_lng, a2_lat, a2_lng);
    if (dist <= radius) {
        return true;
    } else {
        return false;
    }
}

const StatusChecker = (fil, c, candidate) => {
    var f = fil["JobLocation"];
    if (f == 'Remote') { // HR ищет на удаленную работу
        if (c['RemoteOpenYes'] != true) // текущая prefered-location кандидата не подразумевает удаленную работу
            return false;
        if (!fil['RemoteOpenTimezone']) // HR не указал желаемую timezone. Показываем всех кандидатов
            return true;
        var candidate_timezone = TimeZoneToInt(c['RemoteOpenTimezone']);
        var filter_timezone = TimeZoneToInt(fil['RemoteOpenTimezone']);
        var delta = fil['RemoteOpenHours'] ? parseInt(fil['RemoteOpenHours']) : 0;
        if (candidate_timezone >= filter_timezone - delta && candidate_timezone <= filter_timezone + delta) // нужно проверить корректность расчетов
            return true; // кандидат находится в нужном часовом поясе
        else
            return false;
    }
    if (f == 'On-site') { // только офисная работа
        var filter_location = fil['PreferredLocation'];
        if (!filter_location) // HR не указал предпочитаемое место работы, значит показываем всех
            return true;
        var filter_radius = fil['SearchRadius'] ? extractDistanceFromSearch(fil['SearchRadius']) : 100; // если HR не указал radius, дефолтно ставим 100км
        var candidate_main_location = candidate['MainLocationGeo'];
        if (!candidate_main_location) // у кандидата не указан адрес проживания
            return false;
        if (CompareAdresses(filter_location, candidate_main_location, filter_radius)) // сравниваем MainLocation кандидата. Если нас это не устраивает - фильтруем дальше
            return true;

        // проверить, что принимаем из другой страны
        var relocate = fil['EnableToRelocate'];
        var relocate_ww = fil['RelocationWorldWide'];
        var relocate_wc = fil['RelocationWithinCountry'];
        var relocate_asia = fil['RelocationAsia'];
        var relocate_eu = fil['RelocationEU'];
        var work_permit = fil['WorkPermitFromMyCountry'];
        var relocation_countries = fil['RelocationCountries'] ? fil['RelocationCountries'].map((country) => country['countryName']) : [];
        var candidate_country = c['Country'] ? c['Country']['countryName'] : false;
        if (candidate_country == false) { // если у preferedLocation кандидата указана некорректно. 
            return false;
        }
        if (work_permit == true && c['WorkPermission'] == true && c['Country']['countryCode'] == fil['PreferedLocationCountry']) // сравниванием разрешение на работу
            return true; //  нужно проверять города. Не можем вернуть 
        if (c['Country']['countryCode'] != fil['PreferedLocationCountry']) { // если страна кандидата не совпадает со страной работы - проверяем.
            if (!relocate) // HR никого не принимает - сразу нет
                return false;
            var c1 = c['Country']['continentName'] == 'Asia' && relocate_asia;
            var c2 = c['Country']['continentCode'] == 'EU' && relocate_eu;
            var c3 = relocation_countries.includes(candidate_country);

            if (relocate_ww || c1 || c2 || c3) { // если нас устраивает какая-либо релокация
                var results = c['CityGeo'].filter((city) => CompareAdresses(city, filter_location, filter_radius)); // и кандидат хочет переезжать к HR
                if (results.length <= 0)
                    return false;
                else
                    return true;
            }
            return false;
        } else { // кандидат в стране рекрутера
            var results = c['CityGeo'].filter((city) => CompareAdresses(city, filter_location, filter_radius));
            if (results.length > 0 && relocate_wc) // кандидат хочет переехать и рекрутер не против
                return true;
            else
                return false;
        }
    }
    if (f == 'On-site & Remote') {
        if (c['RemoteOpenYes'] == true) { // кандидат не против работать удаленно. Проверяем timezones
            if (!fil['RemoteOpenTimezone']) // HR не указал желаемую timezone. Показываем всех кандидатов
                return true;
            var candidate_timezone = TimeZoneToInt(c['RemoteOpenTimezone']);
            var filter_timezone = TimeZoneToInt(fil['RemoteOpenTimezone']);
            var delta = fil['RemoteOpenHours'] ? parseInt(fil['RemoteOpenHours']) : 0;
            if (candidate_timezone >= filter_timezone - delta && candidate_timezone <= filter_timezone + delta) // нужно проверить корректность расчетов
                return true; // кандидат находится в нужном часовом поясе
        }
        var filter_location = fil['PreferredLocation'];
        var filter_radius = fil['SearchRadius'] ? extractDistanceFromSearch(fil['SearchRadius']) : 100; // если HR не указал radius, дефолтно ставим 100км
        var candidate_main_location = candidate['MainLocationGeo'];
        if (!candidate_main_location) // у кандидата не указан адрес проживания
            return false;
        if (CompareAdresses(filter_location, candidate_main_location, filter_radius)) // сравниваем MainLocation кандидата. Если нас это не устраивает - фильтруем дальше
            return true;

        // проверить, что принимаем из другой страны
        var relocate = fil['EnableToRelocate'];
        var relocate_ww = fil['RelocationWorldWide'];
        var relocate_wc = fil['RelocationWithinCountry'];
        var relocate_asia = fil['RelocationAsia'];
        var relocate_eu = fil['RelocationEU'];
        var work_permit = fil['WorkPermitFromMyCountry'];
        var relocation_countries = fil['RelocationCountries'] ? fil['RelocationCountries'].map((country) => country['countryName']) : [];
        var candidate_country = c['Country'] ? c['Country']['countryName'] : false;
        if (candidate_country == false) { // если у preferedLocation кандидата указана некорректно. 
            return false;
        }
        if (work_permit == true && c['WorkPermission'] == true && c['Country']['countryCode'] == fil['PreferedLocationCountry']) // сравниванием разрешение на работу
            return true; //  нужно проверять города. Не можем вернуть 
        if (c['Country']['countryCode'] != fil['PreferedLocationCountry']) { // если страна кандидата не совпадает со страной работы - проверяем.
            if (!relocate) // HR никого не принимает - сразу нет
                return false;
            var c1 = c['Country']['continentName'] == 'Asia' && relocate_asia;
            var c2 = c['Country']['continentCode'] == 'EU' && relocate_eu;
            var c3 = relocation_countries.includes(candidate_country);

            if (relocate_ww || c1 || c2 || c3) { // если нас устраивает какая-либо релокация
                var results = c['CityGeo'].filter((city) => CompareAdresses(city, filter_location, filter_radius)); // и кандидат хочет переезжать к HR
                if (results.length <= 0)
                    return false;
                else
                    return true;
            }
            return false;
        } else { // кандидат в стране рекрутера
            var results = c['CityGeo'].filter((city) => CompareAdresses(city, filter_location, filter_radius));
            if (results.length > 0 && relocate_wc) // кандидат хочет переехать и рекрутер не против
                return true;
            else
                return false;
        }
    }
    //////
    /////
    ////
}

const StatusChecker2 = (fil, c, candidate) => {
    var f = fil["JobLocation"];
    // 
    // Сравниваем удаленную работу
    //
    if (c['RemoteOpenYes'] != true && f == 'Remote') // текущая prefered-location кандидата не подразумевает удаленную работу
        return false;
    if (!fil['RemoteOpenTimezone'] && (f == 'Remote' || f == 'On-site & Remote') && c['RemoteOpenYes'] == true) // HR не указал желаемую timezone. Показываем всех кандидатов
        return true;
    if (!c['RemoteOpenTimezone'] && f == 'Remote') // кандидат не указал часовой пояс. Выходим
        return false;
    if (c['RemoteOpenTimezone'] && fil['RemoteOpenTimezone']) { // корректно указан часовой пояс. Сравниваем
        var candidate_timezone = TimeZoneToInt(c['RemoteOpenTimezone']);
        var filter_timezone = TimeZoneToInt(fil['RemoteOpenTimezone']);
        var delta = fil['RemoteOpenHours'] ? parseInt(fil['RemoteOpenHours']) : 0;
        var cond1 = f == 'Remote' || (f == 'On-site & Remote' && c['RemoteOpenYes'] == true);
        var cond2 = candidate_timezone >= filter_timezone - delta && candidate_timezone <= filter_timezone + delta;
        if (cond1 && cond2) // нужно проверить корректность расчетов
            return true; // кандидат находится в нужном часовом поясе
    }
    if (f == 'Remote') // дальше удаленную работу не сравниваем.
        return false;
    //
    // Сравниваем очную работу
    //
    var filter_location = fil['PreferredLocation'];
    if (!filter_location) // HR не указал prefered_location, поэтому показываем всех
        return true;
    var filter_radius = fil['SearchRadius'] ? extractDistanceFromSearch(fil['SearchRadius']) : 100; // если HR не указал radius, дефолтно ставим 100км
    var candidate_main_location = candidate['MainLocationGeo'];
    if (!candidate_main_location) // у кандидата не указан адрес проживания
        return false;
    if (CompareAdresses(filter_location, candidate_main_location, filter_radius)) // сравниваем MainLocation кандидата. Если нас это не устраивает - фильтруем дальше
        return true;

    // проверить, что принимаем из другой страны
    var relocate = fil['EnableToRelocate'];
    var relocate_ww = fil['RelocationWorldWide'];
    var relocate_wc = fil['RelocationWithinCountry'];
    var relocate_asia = fil['RelocationAsia'];
    var relocate_eu = fil['RelocationEU'];
    var work_permit = fil['WorkPermitFromMyCountry'];
    var relocation_countries = fil['RelocationCountries'] ? fil['RelocationCountries'].map((country) => country['countryName']) : [];
    var candidate_country = c['Country'] ? c['Country']['countryName'] : false;
    if (candidate_country == false) { // если у preferedLocation кандидата указана некорректно. 
        return false;
    }
    if (work_permit == true && c['WorkPermission'] == true && c['Country']['countryCode'] == fil['PreferedLocationCountry']) // сравниванием разрешение на работу
        return true; //  нужно проверять города. Не можем вернуть 
    if (c['Country']['countryCode'] != fil['PreferedLocationCountry']) { // если страна кандидата не совпадает со страной работы - проверяем.
        if (!relocate) // HR никого не принимает - сразу нет
            return false;
        var c1 = c['Country']['continentName'] == 'Asia' && relocate_asia;
        var c2 = c['Country']['continentCode'] == 'EU' && relocate_eu;
        var c3 = relocation_countries.includes(candidate_country);

        if (relocate_ww || c1 || c2 || c3) { // если нас устраивает какая-либо релокация
            var results = c['CityGeo'].filter((city) => CompareAdresses(city, filter_location, filter_radius)); // и кандидат хочет переезжать к HR
            if (results.length <= 0)
                return false;
            else
                return true;
        }
        return false;
    } else { // кандидат в стране рекрутера
        var results = c['CityGeo'].filter((city) => CompareAdresses(city, filter_location, filter_radius));
        if (results.length > 0 && relocate_wc) // кандидат хочет переехать и рекрутер не против
            return true;
        else
            return false;
    }
}

const paymentModalityToYear = (coeff) => {
    if (coeff == "/ month")
        return 11.363636363636363;
    else if (coeff = "/ hour")
        return 2000;
    else
        return 1;
}

const SalaryComparasion = (f, c) => {
    var min = f["MinSalary"] ? f["MinSalary"] : 0;
    var max = f["MaxSalary"] ? f["MaxSalary"] : 10000000000000;
    if (f["PaymentModality"]) {
        min *= paymentModalityToYear(f["PaymentModality"]);
        max *= paymentModalityToYear(f["PaymentModality"]);
    }
    if (!c['PreferedLocation']) // значит кандидат недозаполнен, или невалиден
        return false;
    var res = c["PreferedLocation"].filter((i) => {
        if (i["SalaryMinimal"]) {
            var val = i["SalaryMinimal"];
            if (i["SalaryPeriod"])
                val *= paymentModalityToYear(i["SalaryPeriod"]);
            return val >= min && val <= max ? true : false;
        }
        return true; // если не указал - значит на все согласен
    });
    return res.length > 0 ? true : false;
}

const SearchCandidateLocation = (f, c) => {
    if (!f['SearchCandidateLocation'])
        return true
    if (!f['MainLocationGeo'])
        return false

    var fil_lat = f['SearchCandidateLocation']['lat'];
    var fil_lng = f['SearchCandidateLocation']['lng'];
    var can_lat = f['MainLocationGeo']['lat'];
    var can_lng = f['MainLocationGeo']['lng'];
    var dist = getDistanceFromLatLonInKm(fil_lat, fil_lng, can_lat, can_lng);
    if (dist <= 100)
        return true;
    else
        return false; 
}

exports.formatted_functions = {
    "toNormalArray": toNormalArray,
    "intersect": intersect,
    "experienceListToRange": experienceListToRange,
    "languageComparasion": languageComparasion,
    "listToBool": ListToBool,
    "rolesComparasion": RolesComparasion,
    "techListComparasion": TechListComparasion,
    'preferedLocationComparasion': PreferedLocationComparasion,
    "salaryComparasion": SalaryComparasion,
    'searchcandidatelocation': SearchCandidateLocation,
}