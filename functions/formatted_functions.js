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
    if (!ListToBool(c["PreferedLocation"])) // загулшка. Незаполненных быть не должно
        return false;

    var results = c["PreferedLocation"].filter((i) => StatusChecker(f, i));
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

const StatusChecker = (fil, c) => {
    if (fil['JobLocation'] == undefined)
        return true;

    var f = fil["JobLocation"];
    if (c["MainLocation"] && (f == "On-site & Remote" || f == "On-site")) { // кандидат выбрал "Open to office"
        if (fil['PreferredLocation']) {
            var res = c['CityGeo'].filter((i) => {
                f_lat = fil["PreferredLocation"]["lat"];
                f_lng = fil["PreferredLocation"]["lng"];
                c_lat = i["lat"];
                c_lng = c["lng"];
                if (f_lat == c_lat && f_lng == c_lng)
                    return true;
                f_dist = extractDistanceFromSearch(fil['SearchRadius']);
                if (f_dist != undefined) {
                    var dist = getDistanceFromLatLonInKm(f_lat, f_lng, c_lat, c_lng);
                    if (dist <= f_dist) {
                        return true;
                    } else {
                        return false;
                    }
                }
            });
            if (res.length != 0)
                return true;
            else {
                if (!c['RemoteOpenYes']) // если кандидат не рассматривает удаленную работу, иначе - проверяем дальше
                    return false;
            }   
        } else {
            return true;    
        }
    }
    if (c["RemoteOpenYes"] && (f == "On-site & Remote" || f == "Remote")) { // сравниваем удаленную работу
        // проверяем часы работы
        if (fil["PreferredTimezone"] && fil["RemoteOpenTimezone"]) {
            var filter_timezone = TimeZoneToInt(fil["RemoteOpenTimezone"]);
            var filter_hours = 0;
            if (f["RemoteOpenHours"])
                filter_hours += parseInt(fil["RemoteOpenHours"]);
            var i = [];
            for (let j= filter_timezone - filter_hours; j <= filter_timezone + filter_hours; j++) {
                i.push(j);
            };
            if (c["RemoteOpenTimezoneNum"]) {
                if (c["RemoteOpenHoursNum"]) {
                    var tmp = [c["RemoteOpenTimezoneNum"] - parseInt(c["RemoteOpenHoursNum"]), c["RemoteOpenTimezoneNum"] + parseInt(c["RemoteOpenHoursNum"])];
                } else {
                    var tmp = [c["RemoteOpenTimezoneNum"], c["RemoteOpenTimezoneNum"]];
                }
                var k = [];
                for (let j = tmp[0]; j <= tmp[1]; j++) {
                    k.push(j);
                }
                // сверяем интервалы
                return intersect(i, k).length == 0 ? false : true;
            } else {
                return true; // будем считать, что кандидату пофиг
            }
        }
        return true;
    }
    // значит переезд
    if (fil["EnableToRelocate"] == false)
        return false // hr запретил переезд

    // Не знаем страну HR (Recruiter - Country)

    // Кандидат из страны, откуда принимают
    if (ListToBool(fil["RelocationCountries"])) {
        var c_country = c["Country"].map((item) => item["countryName"]);
        var f_country = fil["RelocationCountries"].map((item) => item["countryName"]);
        if (intersect(c_country, f_country).length != 0)
            return true;
        else
            return false;
    }
    // Нужно прокинуть Recruiter в фильтры, без этого дальше сравнивать нельзя
    return false;
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